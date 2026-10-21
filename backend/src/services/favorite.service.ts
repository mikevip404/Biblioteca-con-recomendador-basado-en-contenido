import { HttpError } from '../middlewares/error.middleware.js';
import type { BookRepository } from '../repositories/book.repository.js';
import type { FavoriteRepository } from '../repositories/favorite.repository.js';
import { paginate } from '../repositories/query.builder.js';
import type { Book, Paginated } from '../types/catalog.js';
import type { BookSummaryDTO, Favorite, FavoriteDTO } from '../types/ratings.js';
import { averageRating } from '../utils/rating.js';

function toBookSummary(book: Book): BookSummaryDTO {
  const summary: BookSummaryDTO = {
    id: book.id,
    title: book.title,
    averageRating: averageRating(book.ratingCount, book.ratingSum)
  };
  if (book.coverUrl !== undefined) summary.coverUrl = book.coverUrl;
  return summary;
}

function toFavoriteDTO(favorite: Favorite, book: BookSummaryDTO): FavoriteDTO {
  return {
    id: favorite.id,
    createdAt: favorite.createdAt.toISOString(),
    book
  };
}

/** Lógica de favoritos. Alta y baja son idempotentes. */
export class FavoriteService {
  constructor(
    private readonly favorites: FavoriteRepository,
    private readonly books: BookRepository
  ) {}

  /** `PUT /books/:bookId/favorite`: marca favorito (idempotente). */
  async add(userId: string, bookId: string): Promise<void> {
    const book = await this.books.findById(bookId);
    if (book === null) {
      throw HttpError.notFound('Libro no encontrado');
    }
    await this.favorites.add(userId, bookId);
  }

  /** `DELETE /books/:bookId/favorite`: quita de favoritos (idempotente). */
  async remove(userId: string, bookId: string): Promise<void> {
    await this.favorites.remove(userId, bookId);
  }

  /** `GET /me/favorites`: mis favoritos con datos básicos del libro. */
  async listMine(
    userId: string,
    page: number,
    limit: number
  ): Promise<Paginated<FavoriteDTO>> {
    const { items, total, pagination } = await this.favorites.listByUser(
      userId,
      page,
      limit
    );
    const bookIds = [...new Set(items.map((favorite) => favorite.bookId))];
    const books = await this.books.findByIds(bookIds);
    const bookById = new Map(books.map((book) => [book.id, book]));
    const data: FavoriteDTO[] = items.map((favorite) => {
      const book = bookById.get(favorite.bookId);
      const summary: BookSummaryDTO =
        book === undefined
          ? { id: favorite.bookId, title: '', averageRating: 0 }
          : toBookSummary(book);
      return toFavoriteDTO(favorite, summary);
    });
    return paginate(data, total, pagination);
  }
}
