import type { UnitOfWork } from '../db/mongo.js';
import { HttpError } from '../middlewares/error.middleware.js';
import type { BookRepository } from '../repositories/book.repository.js';
import type { RatingRepository } from '../repositories/rating.repository.js';
import { paginate } from '../repositories/query.builder.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type {
  BookSummaryDTO,
  Rating,
  RatingDTO,
  RatingWithBookDTO,
  RatingWithUserDTO
} from '../types/ratings.js';
import type { Book, Paginated } from '../types/catalog.js';
import { escapeHtml } from '../utils/html.js';
import { averageRating } from '../utils/rating.js';

/** Reintentos ante la carrera de dos altas simultáneas (clave duplicada). */
const MAX_UPSERT_ATTEMPTS = 3;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

function toBookSummary(book: Book): BookSummaryDTO {
  const summary: BookSummaryDTO = {
    id: book.id,
    title: book.title,
    averageRating: averageRating(book.ratingCount, book.ratingSum)
  };
  if (book.coverUrl !== undefined) summary.coverUrl = book.coverUrl;
  return summary;
}

function toRatingDTO(rating: Rating): RatingDTO {
  const dto: RatingDTO = {
    id: rating.id,
    value: rating.value,
    createdAt: rating.createdAt.toISOString(),
    updatedAt: rating.updatedAt.toISOString()
  };
  if (rating.comment !== undefined) dto.comment = rating.comment;
  return dto;
}

/** Lógica de valoraciones. Mantiene los contadores del libro consistentes. */
export class RatingService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ratings: RatingRepository,
    private readonly books: BookRepository,
    private readonly users: UserRepository
  ) {}

  /** `PUT /books/:bookId/rating`: alta o actualización idempotente. */
  async putMyRating(
    userId: string,
    bookId: string,
    value: number,
    comment?: string
  ): Promise<RatingDTO> {
    const safeComment = comment === undefined ? undefined : escapeHtml(comment);

    let result: { rating: Rating } | undefined;
    for (let attempt = 0; attempt < MAX_UPSERT_ATTEMPTS; attempt++) {
      try {
        result = await this.uow.withTransaction(async () => {
          const book = await this.books.findById(bookId);
          if (book === null) {
            throw HttpError.notFound('Libro no encontrado');
          }
          const current = await this.ratings.findByUserAndBook(userId, bookId);
          if (current === null) {
            const created = await this.ratings.insert(userId, bookId, value, safeComment);
            await this.books.applyRatingDelta(bookId, 1, value);
            return { rating: created };
          }
          const delta = value - current.value;
          const updated = (await this.ratings.updateById(current.id, value, safeComment)) ?? current;
          if (delta !== 0) {
            await this.books.applyRatingDelta(bookId, 0, delta);
          }
          return { rating: updated };
        });
        break;
      } catch (error) {
        // Carrera: otra petición insertó la misma (userId, bookId) antes.
        if (isDuplicateKeyError(error) && attempt < MAX_UPSERT_ATTEMPTS - 1) {
          continue;
        }
        throw error;
      }
    }

    if (result === undefined) {
      throw HttpError.internal('No se pudo guardar la valoración');
    }
    return toRatingDTO(result.rating);
  }

  /** `DELETE /books/:bookId/rating`: elimina MI valoración (idempotente). */
  async deleteMyRating(userId: string, bookId: string): Promise<void> {
    await this.uow.withTransaction(async () => {
      const current = await this.ratings.findByUserAndBook(userId, bookId);
      if (current === null) return;
      await this.ratings.deleteById(current.id);
      await this.books.applyRatingDelta(bookId, -1, -current.value);
    });
  }

  /**
   * `DELETE /ratings/:id`: borra una valoración verificando propiedad.
   * `requireOwnership` ya filtra en el borde; aquí se revalida (defensa).
   */
  async deleteRating(
    actorId: string,
    actorIsAdmin: boolean,
    ratingId: string
  ): Promise<void> {
    await this.uow.withTransaction(async () => {
      const rating = await this.ratings.findById(ratingId);
      if (rating === null) {
        throw HttpError.notFound('Valoración no encontrada');
      }
      if (!actorIsAdmin && rating.userId !== actorId) {
        throw HttpError.forbidden('No puedes borrar la valoración de otro usuario');
      }
      await this.ratings.deleteById(rating.id);
      await this.books.applyRatingDelta(rating.bookId, -1, -rating.value);
    });
  }

  /** `GET /books/:bookId/ratings`: valoraciones del libro con nombre de autor. */
  async listByBook(
    bookId: string,
    page: number,
    limit: number
  ): Promise<Paginated<RatingWithUserDTO>> {
    const book = await this.books.findById(bookId);
    if (book === null) {
      throw HttpError.notFound('Libro no encontrado');
    }
    const { items, total, pagination } = await this.ratings.listByBook(bookId, page, limit);
    const userIds = [...new Set(items.map((rating) => rating.userId))];
    const users = await this.users.findByIds(userIds);
    const nameById = new Map(users.map((user) => [user.id, user.fullName]));
    const data: RatingWithUserDTO[] = items.map((rating) => ({
      ...toRatingDTO(rating),
      user: { id: rating.userId, name: nameById.get(rating.userId) ?? '' }
    }));
    return paginate(data, total, pagination);
  }

  /** `GET /me/ratings`: mis valoraciones con datos básicos del libro. */
  async listMine(
    userId: string,
    page: number,
    limit: number
  ): Promise<Paginated<RatingWithBookDTO>> {
    const { items, total, pagination } = await this.ratings.listByUser(userId, page, limit);
    const bookIds = [...new Set(items.map((rating) => rating.bookId))];
    const books = await this.books.findByIds(bookIds);
    const bookById = new Map(books.map((book) => [book.id, book]));
    const data: RatingWithBookDTO[] = items.map((rating) => {
      const book = bookById.get(rating.bookId);
      const summary: BookSummaryDTO =
        book === undefined
          ? { id: rating.bookId, title: '', averageRating: 0 }
          : toBookSummary(book);
      return { ...toRatingDTO(rating), book: summary };
    });
    return paginate(data, total, pagination);
  }

  /** Id del dueño de una valoración (resolutor de `requireOwnership`). */
  async findOwnerId(ratingId: string): Promise<string | undefined> {
    const ownerId = await this.ratings.findOwnerId(ratingId);
    return ownerId ?? undefined;
  }
}
