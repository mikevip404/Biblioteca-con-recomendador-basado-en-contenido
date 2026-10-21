import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ratingsApi } from '@/api/ratingsApi';
import { useBooksStore } from '@/stores/books';
import { useRatingsStore } from '@/stores/ratings';
import { ApiError } from '@/types';
import type {
  BookDTO,
  Paginated,
  RatingDTO,
  RatingWithBookDTO,
  RatingWithUserDTO
} from '@/types';

vi.mock('@/api/ratingsApi', () => ({
  ratingsApi: {
    putMine: vi.fn(),
    deleteMine: vi.fn(),
    listByBook: vi.fn(),
    listMine: vi.fn(),
    remove: vi.fn()
  }
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

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function pageOf<T>(items: T[], overrides: Partial<Paginated<T>> = {}): Paginated<T> {
  return {
    data: items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    ...overrides
  };
}

describe('ratingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('aplica la valoración optimista y actualiza el libro y el promedio', async () => {
    const books = useBooksStore();
    books.seedBook(book({ averageRating: 4, ratingCount: 2 }));
    const pending = deferred<RatingDTO>();
    vi.mocked(ratingsApi.putMine).mockReturnValue(pending.promise);
    const ratings = useRatingsStore();

    const promise = ratings.saveMyRating('b1', 5, 'bueno');

    // Estado optimista visible antes de que resuelva la API.
    expect(ratings.myRatingFor('b1')?.value).toBe(5);
    expect(ratings.isSaving('b1')).toBe(true);
    expect(books.getBook('b1')?.myRating).toBe(5);
    expect(books.getBook('b1')?.ratingCount).toBe(3);
    expect(books.getBook('b1')?.averageRating).toBeCloseTo(4.33, 2);

    pending.resolve({
      id: 'r1',
      value: 5,
      comment: 'bueno',
      createdAt: '2024-02-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:00.000Z'
    });
    await promise;

    expect(ratings.myRatingFor('b1')?.id).toBe('r1');
    expect(ratings.isSaving('b1')).toBe(false);
    expect(ratingsApi.putMine).toHaveBeenCalledWith('b1', { value: 5, comment: 'bueno' });
  });

  it('revierte la valoración optimista cuando la API falla', async () => {
    const books = useBooksStore();
    books.seedBook(book({ averageRating: 4, ratingCount: 2 }));
    vi.mocked(ratingsApi.putMine).mockRejectedValue(new ApiError(500, 'ERR', 'boom'));
    const ratings = useRatingsStore();

    await expect(ratings.saveMyRating('b1', 5)).rejects.toBeInstanceOf(ApiError);

    expect(ratings.myRatingFor('b1')).toBeUndefined();
    expect(books.getBook('b1')?.myRating).toBeUndefined();
    expect(books.getBook('b1')?.ratingCount).toBe(2);
    expect(books.getBook('b1')?.averageRating).toBe(4);
  });

  it('editar una valoración existente ajusta la suma sin cambiar el contador', async () => {
    const books = useBooksStore();
    books.seedBook(book({ averageRating: 4, ratingCount: 2, myRating: 4 }));
    const ratings = useRatingsStore();
    ratings.setMyRatingLocal('b1', {
      id: 'r1',
      value: 4,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    });
    const pending = deferred<RatingDTO>();
    vi.mocked(ratingsApi.putMine).mockReturnValue(pending.promise);

    void ratings.saveMyRating('b1', 5);

    expect(books.getBook('b1')?.ratingCount).toBe(2);
    expect(books.getBook('b1')?.averageRating).toBeCloseTo(4.5, 2);

    pending.resolve({
      id: 'r1',
      value: 5,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z'
    });
  });

  it('elimina mi valoración de forma optimista y revierte si falla', async () => {
    const books = useBooksStore();
    books.seedBook(book({ averageRating: 4, ratingCount: 2, myRating: 4 }));
    const ratings = useRatingsStore();
    ratings.setMyRatingLocal('b1', {
      id: 'r1',
      value: 4,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    });
    vi.mocked(ratingsApi.deleteMine).mockRejectedValue(new ApiError(500, 'ERR', 'boom'));

    await expect(ratings.deleteMyRating('b1')).rejects.toBeInstanceOf(ApiError);

    expect(ratings.myRatingFor('b1')?.value).toBe(4);
    expect(books.getBook('b1')?.myRating).toBe(4);
    expect(books.getBook('b1')?.ratingCount).toBe(2);
  });

  it('normaliza las valoraciones del libro y guarda la paginación', async () => {
    const ratings = useRatingsStore();
    const rating: RatingWithUserDTO = {
      id: 'r1',
      value: 5,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      user: { id: 'u2', name: 'Lectora' }
    };
    vi.mocked(ratingsApi.listByBook).mockResolvedValue(pageOf([rating]));

    await ratings.fetchBookRatings('b1', { page: 1, limit: 10 });

    expect(ratings.ratingsForBook('b1')).toHaveLength(1);
    expect(ratings.byId['r1']?.user.name).toBe('Lectora');
    expect(ratings.bookMeta('b1')?.totalPages).toBe(1);
    expect(ratingsApi.listByBook).toHaveBeenCalledWith('b1', 1, 10, {});
  });

  it('carga mis valoraciones y siembra mi valoración por libro', async () => {
    const ratings = useRatingsStore();
    const mine: RatingWithBookDTO = {
      id: 'r9',
      value: 4,
      comment: 'está bien',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      book: { id: 'b1', title: 'Uno', averageRating: 4 }
    };
    vi.mocked(ratingsApi.listMine).mockResolvedValue(pageOf([mine]));

    await ratings.fetchMine({ page: 1, limit: 20 });

    expect(ratings.mine).toHaveLength(1);
    expect(ratings.myRatingFor('b1')?.value).toBe(4);
    expect(ratings.myRatingFor('b1')?.comment).toBe('está bien');
  });
});
