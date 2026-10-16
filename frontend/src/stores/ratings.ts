import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { ratingsApi } from '@/api/ratingsApi';
import { useBooksStore } from '@/stores/books';
import type {
  ApiRequestOptions,
  RatingBodyRequest,
  RatingDTO,
  RatingValue,
  RatingWithBookDTO,
  RatingWithUserDTO
} from '@/types';
import { apiErrorMessage } from '@/utils/errors';

/** Metadatos de paginación de un listado de valoraciones. */
export interface RatingsPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BookRatingsPage extends RatingsPageMeta {
  ids: string[];
}

const EMPTY_PAGE: RatingsPageMeta = { page: 1, limit: 20, total: 0, totalPages: 0 };

function wasAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function buildDto(input: {
  id: string;
  value: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}): RatingDTO {
  const dto: RatingDTO = {
    id: input.id,
    value: input.value,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
  if (input.comment !== undefined) dto.comment = input.comment;
  return dto;
}

/**
 * Valoraciones normalizadas por id.
 *
 * - `byId`: valoraciones públicas de un libro (con el autor).
 * `bookPages`: ids + paginación por libro.
 * - `mineById`/`mineIds`: mis valoraciones (con datos básicos del libro).
 * - `myRatingByBook`: mi valoración por libro (fuente del formulario del
 *   detalle), que se comparte con `booksStore` al valorar.
 *
 * Las acciones de escritura son optimistas: cambian el estado y, si la API
 * falla, revierten el libro y los listados afectados.
 */
export const useRatingsStore = defineStore('ratings', () => {
  const byId = ref<Record<string, RatingWithUserDTO>>({});
  const bookPages = ref<Record<string, BookRatingsPage>>({});
  const bookLoading = ref<Set<string>>(new Set());
  const bookError = ref<Record<string, string>>({});

  const mineById = ref<Record<string, RatingWithBookDTO>>({});
  const mineIds = ref<string[]>([]);
  const mineMeta = ref<RatingsPageMeta>(EMPTY_PAGE);
  const mineLoading = ref(false);
  const mineError = ref<string | null>(null);

  const myRatingByBook = ref<Record<string, RatingDTO | null>>({});
  const savingBooks = ref<Set<string>>(new Set());

  const mine = computed<RatingWithBookDTO[]>(() => {
    const result: RatingWithBookDTO[] = [];
    for (const id of mineIds.value) {
      const rating = mineById.value[id];
      if (rating !== undefined) result.push(rating);
    }
    return result;
  });

  function myRatingFor(bookId: string): RatingDTO | null | undefined {
    return myRatingByBook.value[bookId];
  }

  function isSaving(bookId: string): boolean {
    return savingBooks.value.has(bookId);
  }

  function setMyRatingLocal(bookId: string, rating: RatingDTO | null): void {
    myRatingByBook.value = { ...myRatingByBook.value, [bookId]: rating };
  }

  function ratingsForBook(bookId: string): RatingWithUserDTO[] {
    const page = bookPages.value[bookId];
    if (page === undefined) return [];
    const result: RatingWithUserDTO[] = [];
    for (const id of page.ids) {
      const rating = byId.value[id];
      if (rating !== undefined) result.push(rating);
    }
    return result;
  }

  function bookMeta(bookId: string): BookRatingsPage | undefined {
    return bookPages.value[bookId];
  }

  function isLoadingBook(bookId: string): boolean {
    return bookLoading.value.has(bookId);
  }

  function bookErrorFor(bookId: string): string | null {
    return bookError.value[bookId] ?? null;
  }

  /** Mi valoración dentro del listado de mis valoraciones (si está cargado). */
  function mineForBook(bookId: string): RatingWithBookDTO | undefined {
    for (const id of mineIds.value) {
      const rating = mineById.value[id];
      if (rating !== undefined && rating.book.id === bookId) return rating;
    }
    return undefined;
  }

  async function fetchBookRatings(
    bookId: string,
    options: { page?: number; limit?: number; signal?: AbortSignal } = {}
  ): Promise<void> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    bookLoading.value.add(bookId);
    delete bookError.value[bookId];

    const requestOptions: ApiRequestOptions = {};
    if (options.signal !== undefined) requestOptions.signal = options.signal;

    try {
      const result = await ratingsApi.listByBook(bookId, page, limit, requestOptions);
      for (const rating of result.data) {
        byId.value[rating.id] = rating;
      }
      bookPages.value = {
        ...bookPages.value,
        [bookId]: {
          ids: result.data.map((rating) => rating.id),
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      };
    } catch (error) {
      if (wasAborted(options.signal)) return;
      bookError.value = { ...bookError.value, [bookId]: apiErrorMessage(error) };
    } finally {
      bookLoading.value.delete(bookId);
    }
  }

  async function fetchMine(
    options: { page?: number; limit?: number; signal?: AbortSignal } = {}
  ): Promise<void> {
    const page = options.page ?? 1;
    const limit = options.limit ?? mineMeta.value.limit;
    mineLoading.value = true;
    mineError.value = null;

    const requestOptions: ApiRequestOptions = {};
    if (options.signal !== undefined) requestOptions.signal = options.signal;

    try {
      const result = await ratingsApi.listMine(page, limit, requestOptions);
      const nextById: Record<string, RatingWithBookDTO> = {};
      for (const rating of result.data) {
        nextById[rating.id] = rating;
        setMyRatingLocal(rating.book.id, buildDto(rating));
      }
      mineById.value = nextById;
      mineIds.value = result.data.map((rating) => rating.id);
      mineMeta.value = {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      };
    } catch (error) {
      if (wasAborted(options.signal)) return;
      mineError.value = apiErrorMessage(error);
    } finally {
      mineLoading.value = false;
    }
  }

  function patchMineList(bookId: string, rating: RatingDTO): void {
    const current = mineForBook(bookId);
    if (current === undefined) return;
    mineById.value = {
      ...mineById.value,
      [current.id]: { ...current, ...rating }
    };
  }

  function dropFromMineList(bookId: string): RatingWithBookDTO | undefined {
    const current = mineForBook(bookId);
    if (current === undefined) return undefined;
    const next = { ...mineById.value };
    delete next[current.id];
    mineById.value = next;
    mineIds.value = mineIds.value.filter((id) => id !== current.id);
    return current;
  }

  /**
   * Guarda (alta o edición) mi valoración de forma optimista. Actualiza el
   * libro, el promedio y las listas; revierte todo si la API falla.
   */
  async function saveMyRating(
    bookId: string,
    value: RatingValue,
    comment?: string
  ): Promise<RatingDTO> {
    const books = useBooksStore();
    const book = books.getBook(bookId);
    const bookSnapshot = book === undefined ? undefined : { ...book };
    const hadPrevious = Object.prototype.hasOwnProperty.call(myRatingByBook.value, bookId);
    const previous = myRatingByBook.value[bookId] ?? null;
    const now = new Date().toISOString();
    const optimisticId = previous?.id ?? `local-${bookId}`;

    const optimisticInput: {
      id: string;
      value: number;
      comment?: string;
      createdAt: string;
      updatedAt: string;
    } = {
      id: optimisticId,
      value,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now
    };
    if (comment !== undefined) optimisticInput.comment = comment;
    const optimistic = buildDto(optimisticInput);

    setMyRatingLocal(bookId, optimistic);
    books.setMyRating(bookId, value);
    books.applyRatingChange(
      bookId,
      previous === null ? 1 : 0,
      previous === null ? value : value - previous.value
    );
    savingBooks.value.add(bookId);

    const body: RatingBodyRequest = { value };
    if (comment !== undefined && comment !== '') body.comment = comment;

    try {
      const saved = await ratingsApi.putMine(bookId, body);
      setMyRatingLocal(bookId, saved);
      books.setMyRating(bookId, saved.value);
      patchMineList(bookId, saved);
      return saved;
    } catch (error) {
      if (hadPrevious) {
        setMyRatingLocal(bookId, previous);
      } else {
        const next = { ...myRatingByBook.value };
        delete next[bookId];
        myRatingByBook.value = next;
      }
      if (bookSnapshot !== undefined) books.seedBook(bookSnapshot);
      throw error;
    } finally {
      savingBooks.value.delete(bookId);
    }
  }

  /** Elimina mi valoración de un libro de forma optimista. */
  async function deleteMyRating(bookId: string): Promise<void> {
    const previous = myRatingByBook.value[bookId];
    if (previous === undefined || previous === null) return;
    const books = useBooksStore();
    const bookSnapshot = books.getBook(bookId);

    setMyRatingLocal(bookId, null);
    books.setMyRating(bookId, null);
    books.applyRatingChange(bookId, -1, -previous.value);
    const removedFromMine = dropFromMineList(bookId);

    try {
      await ratingsApi.deleteMine(bookId);
    } catch (error) {
      setMyRatingLocal(bookId, previous);
      if (bookSnapshot !== undefined) books.seedBook({ ...bookSnapshot });
      if (removedFromMine !== undefined) {
        mineById.value = { ...mineById.value, [removedFromMine.id]: removedFromMine };
        mineIds.value = [removedFromMine.id, ...mineIds.value];
      }
      throw error;
    }
  }

  /** Elimina una valoración propia por id (vista "Mis valoraciones"). */
  async function deleteRating(id: string, bookId: string): Promise<void> {
    const previous = mineById.value[id];
    if (previous === undefined) return;
    const books = useBooksStore();
    const bookSnapshot = books.getBook(bookId);
    const previousMyRating = myRatingByBook.value[bookId];

    const nextMine = { ...mineById.value };
    delete nextMine[id];
    mineById.value = nextMine;
    mineIds.value = mineIds.value.filter((current) => current !== id);
    setMyRatingLocal(bookId, null);
    books.setMyRating(bookId, null);
    books.applyRatingChange(bookId, -1, -previous.value);

    try {
      await ratingsApi.remove(id);
    } catch (error) {
      mineById.value = { ...mineById.value, [id]: previous };
      mineIds.value = [id, ...mineIds.value];
      if (previousMyRating === undefined) {
        const restored = { ...myRatingByBook.value };
        delete restored[bookId];
        myRatingByBook.value = restored;
      } else {
        setMyRatingLocal(bookId, previousMyRating);
      }
      if (bookSnapshot !== undefined) books.seedBook({ ...bookSnapshot });
      throw error;
    }
  }

  return {
    byId,
    bookPages,
    bookLoading,
    bookError,
    mineById,
    mineIds,
    mineMeta,
    mineLoading,
    mineError,
    mine,
    myRatingFor,
    isSaving,
    setMyRatingLocal,
    ratingsForBook,
    bookMeta,
    isLoadingBook,
    bookErrorFor,
    mineForBook,
    fetchBookRatings,
    fetchMine,
    saveMyRating,
    deleteMyRating,
    deleteRating
  };
});
