import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { favoritesApi } from '@/api/favoritesApi';
import { useBooksStore } from '@/stores/books';
import { useFavoritesStore } from '@/stores/favorites';
import { ApiError } from '@/types';
import type { BookDTO, BookSummaryDTO, FavoriteDTO, FavoriteToggleDTO, Paginated } from '@/types';

vi.mock('@/api/favoritesApi', () => ({
  favoritesApi: { add: vi.fn(), remove: vi.fn(), listMine: vi.fn() }
}));

function book(overrides: Partial<BookDTO> = {}): BookDTO {
  return {
    id: 'b1',
    title: 'Uno',
    author: { id: 'a1', name: 'Autor' },
    genres: [],
    tags: [],
    createdBy: 'u1',
    averageRating: 4,
    ratingCount: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

const SUMMARY: BookSummaryDTO = { id: 'b1', title: 'Uno', averageRating: 4 };

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function favoritePage(items: FavoriteDTO[]): Paginated<FavoriteDTO> {
  return { data: items, total: items.length, page: 1, limit: 20, totalPages: 1 };
}

describe('favoritesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('marca favorito de forma optimista y actualiza el libro y el listado', async () => {
    const books = useBooksStore();
    books.seedBook(book({ isFavorite: false }));
    const pending = deferred<FavoriteToggleDTO>();
    vi.mocked(favoritesApi.add).mockReturnValue(pending.promise);
    const favorites = useFavoritesStore();

    const promise = favorites.setFavorite(SUMMARY, true);

    expect(favorites.isFavorite('b1')).toBe(true);
    expect(books.getBook('b1')?.isFavorite).toBe(true);
    expect(favorites.list.map((item) => item.book.id)).toContain('b1');

    pending.resolve({ bookId: 'b1', isFavorite: true });
    await promise;

    expect(favorites.isFavorite('b1')).toBe(true);
    expect(favoritesApi.add).toHaveBeenCalledWith('b1');
  });

  it('revierte el favorito optimista cuando la API falla', async () => {
    const books = useBooksStore();
    books.seedBook(book({ isFavorite: false }));
    vi.mocked(favoritesApi.add).mockRejectedValue(new ApiError(500, 'ERR', 'boom'));
    const favorites = useFavoritesStore();
    favorites.setMembershipLocal('b1', false);

    await expect(favorites.setFavorite(SUMMARY, true)).rejects.toBeInstanceOf(ApiError);

    expect(favorites.isFavorite('b1')).toBe(false);
    expect(books.getBook('b1')?.isFavorite).toBe(false);
    expect(favorites.list).toHaveLength(0);
  });

  it('quita un favorito del listado de forma optimista', async () => {
    vi.mocked(favoritesApi.remove).mockResolvedValue({ bookId: 'b1', isFavorite: false });
    const favorites = useFavoritesStore();
    vi.mocked(favoritesApi.listMine).mockResolvedValue(
      favoritePage([
        { id: 'f1', createdAt: '2024-01-01T00:00:00.000Z', book: SUMMARY }
      ])
    );

    await favorites.fetchMine({ page: 1, limit: 20 });
    expect(favorites.list).toHaveLength(1);

    await favorites.remove('f1');

    expect(favorites.list).toHaveLength(0);
    expect(favorites.isFavorite('b1')).toBe(false);
    expect(favoritesApi.remove).toHaveBeenCalledWith('b1');
  });

  it('revierte si falla quitar un favorito del listado', async () => {
    vi.mocked(favoritesApi.remove).mockRejectedValue(new ApiError(500, 'ERR', 'boom'));
    const favorites = useFavoritesStore();
    vi.mocked(favoritesApi.listMine).mockResolvedValue(
      favoritePage([
        { id: 'f1', createdAt: '2024-01-01T00:00:00.000Z', book: SUMMARY }
      ])
    );

    await favorites.fetchMine({ page: 1, limit: 20 });

    await expect(favorites.remove('f1')).rejects.toBeInstanceOf(ApiError);

    expect(favorites.list).toHaveLength(1);
    expect(favorites.isFavorite('b1')).toBe(true);
  });
});
