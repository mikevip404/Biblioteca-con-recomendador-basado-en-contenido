import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { favoritesApi } from '@/api/favoritesApi';
import { useBooksStore } from '@/stores/books';
import type { RatingsPageMeta } from '@/stores/ratings';
import type { ApiRequestOptions, BookSummaryDTO, FavoriteDTO } from '@/types';
import { apiErrorMessage } from '@/utils/errors';

const EMPTY_PAGE: RatingsPageMeta = { page: 1, limit: 20, total: 0, totalPages: 0 };

function wasAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/**
 * Favoritos normalizados por id + pertenencia por libro (`bookId → boolean`)
 * para poder alternar desde el detalle sin lista cargada. Las altas/bajas son
 * optimistas y revierten si la API falla.
 */
export const useFavoritesStore = defineStore('favorites', () => {
  const byId = ref<Record<string, FavoriteDTO>>({});
  const ids = ref<string[]>([]);
  const meta = ref<RatingsPageMeta>(EMPTY_PAGE);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const membership = ref<Record<string, boolean>>({});
  const favoriteIdByBook = ref<Record<string, string>>({});
  const toggling = ref<Set<string>>(new Set());

  const list = computed<FavoriteDTO[]>(() => {
    const result: FavoriteDTO[] = [];
    for (const id of ids.value) {
      const favorite = byId.value[id];
      if (favorite !== undefined) result.push(favorite);
    }
    return result;
  });

  function isFavorite(bookId: string): boolean | undefined {
    return membership.value[bookId];
  }

  function isToggling(bookId: string): boolean {
    return toggling.value.has(bookId);
  }

  function setMembershipLocal(bookId: string, value: boolean): void {
    membership.value = { ...membership.value, [bookId]: value };
  }

  async function fetchMine(
    options: { page?: number; limit?: number; signal?: AbortSignal } = {}
  ): Promise<void> {
    const page = options.page ?? 1;
    const limit = options.limit ?? meta.value.limit;
    loading.value = true;
    error.value = null;

    const requestOptions: ApiRequestOptions = {};
    if (options.signal !== undefined) requestOptions.signal = options.signal;

    try {
      const result = await favoritesApi.listMine(page, limit, requestOptions);
      const nextById: Record<string, FavoriteDTO> = {};
      const nextMembership = { ...membership.value };
      const nextMap = { ...favoriteIdByBook.value };
      for (const favorite of result.data) {
        nextById[favorite.id] = favorite;
        nextMembership[favorite.book.id] = true;
        nextMap[favorite.book.id] = favorite.id;
      }
      byId.value = nextById;
      ids.value = result.data.map((favorite) => favorite.id);
      meta.value = {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      };
      membership.value = nextMembership;
      favoriteIdByBook.value = nextMap;
    } catch (err) {
      if (wasAborted(options.signal)) return;
      error.value = apiErrorMessage(err);
    } finally {
      loading.value = false;
    }
  }

  function revertToggle(
    book: BookSummaryDTO,
    previousMembership: boolean | undefined,
    previousById: Record<string, FavoriteDTO>,
    previousIds: string[],
    previousFavoriteId: string | undefined
  ): void {
    byId.value = previousById;
    ids.value = previousIds;
    const nextMap = { ...favoriteIdByBook.value };
    if (previousFavoriteId === undefined) {
      delete nextMap[book.id];
    } else {
      nextMap[book.id] = previousFavoriteId;
    }
    favoriteIdByBook.value = nextMap;

    const nextMembership = { ...membership.value };
    if (previousMembership === undefined) {
      delete nextMembership[book.id];
    } else {
      nextMembership[book.id] = previousMembership;
    }
    membership.value = nextMembership;
  }

  /** Marca/desmarca un favorito de forma optimista (revierte si falla). */
  async function setFavorite(book: BookSummaryDTO, value: boolean): Promise<void> {
    const books = useBooksStore();
    const previousMembership = membership.value[book.id];
    if (previousMembership === value) return;

    const previousById = byId.value;
    const previousIds = ids.value;
    const previousFavoriteId = favoriteIdByBook.value[book.id];

    membership.value = { ...membership.value, [book.id]: value };
    books.setFavorite(book.id, value);

    if (value) {
      const tempId = `local-${book.id}`;
      byId.value = {
        ...byId.value,
        [tempId]: { id: tempId, createdAt: new Date().toISOString(), book }
      };
      ids.value = [tempId, ...ids.value];
      favoriteIdByBook.value = { ...favoriteIdByBook.value, [book.id]: tempId };
    } else if (previousFavoriteId !== undefined) {
      const nextById = { ...byId.value };
      delete nextById[previousFavoriteId];
      byId.value = nextById;
      ids.value = ids.value.filter((id) => id !== previousFavoriteId);
      const nextMap = { ...favoriteIdByBook.value };
      delete nextMap[book.id];
      favoriteIdByBook.value = nextMap;
    }

    toggling.value.add(book.id);
    try {
      if (value) {
        await favoritesApi.add(book.id);
      } else {
        await favoritesApi.remove(book.id);
      }
    } catch (err) {
      revertToggle(book, previousMembership, previousById, previousIds, previousFavoriteId);
      books.setFavorite(book.id, previousMembership ?? false);
      throw err;
    } finally {
      toggling.value.delete(book.id);
    }
  }

  /** Alterna el estado de favorito del libro. */
  async function toggle(book: BookSummaryDTO): Promise<void> {
    await setFavorite(book, membership.value[book.id] !== true);
  }

  /** Quita un favorito del listado por su id. */
  async function remove(favoriteId: string): Promise<void> {
    const favorite = byId.value[favoriteId];
    if (favorite === undefined) return;
    await setFavorite(favorite.book, false);
  }

  function invalidate(): void {
    byId.value = {};
    ids.value = [];
    meta.value = EMPTY_PAGE;
  }

  return {
    byId,
    ids,
    meta,
    loading,
    error,
    membership,
    favoriteIdByBook,
    toggling,
    list,
    isFavorite,
    isToggling,
    setMembershipLocal,
    fetchMine,
    setFavorite,
    toggle,
    remove,
    invalidate
  };
});
