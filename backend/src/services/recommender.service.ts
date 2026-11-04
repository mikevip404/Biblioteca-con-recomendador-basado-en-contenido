import { randomUUID } from 'node:crypto';

import { HttpError } from '../middlewares/error.middleware.js';
import type { AuthorRepository } from '../repositories/author.repository.js';
import type { BookRepository } from '../repositories/book.repository.js';
import type { BookVectorRepository } from '../repositories/book-vector.repository.js';
import type { FavoriteRepository } from '../repositories/favorite.repository.js';
import type { GenreRepository } from '../repositories/genre.repository.js';
import type { RatingRepository } from '../repositories/rating.repository.js';
import type { Book } from '../types/catalog.js';
import type {
  FeatureNames,
  FeatureVector
} from '../utils/recommender.js';
import {
  buildBookVector,
  buildCorpusIdf,
  cosineSimilarity,
  sharedReasons,
  weightedSum
} from '../utils/recommender.js';
import type {
  GraphDTO,
  GraphNodeDTO,
  RecommendationSetDTO,
  RebuildStatus,
  RecommenderBookDTO,
  SimilarBookDTO
} from '../types/recommender.js';
import { averageRating } from '../utils/rating.js';

/** Máximo de trabajos de reconstrucción conservados en memoria. */
const MAX_JOBS = 20;

interface RecommenderContext {
  books: Book[];
  vectors: Map<string, FeatureVector>;
  names: FeatureNames;
  genreNames: Map<string, string>;
}

interface ScoredBook {
  book: Book;
  score: number;
  reasons: SimilarBookDTO['reasons'];
}

function roundScore(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function average(book: Book): number {
  return averageRating(book.ratingCount, book.ratingSum);
}

function compareScored(left: ScoredBook, right: ScoredBook): number {
  if (right.score !== left.score) return right.score - left.score;
  const averageDelta = average(right.book) - average(left.book);
  if (averageDelta !== 0) return averageDelta;
  if (right.book.ratingCount !== left.book.ratingCount) {
    return right.book.ratingCount - left.book.ratingCount;
  }
  return left.book.title.localeCompare(right.book.title);
}

/**
 * Recomendador basado en contenido. Construye vectores dispersos (géneros,
 * tags, autor, idioma, época y extensión), calcula la similitud de coseno a
 * mano y explica cada recomendación con las características compartidas.
 */
export class RecommenderService {
  private readonly jobs = new Map<string, RebuildStatus>();
  private latestJobId: string | null = null;

  constructor(
    private readonly books: BookRepository,
    private readonly ratings: RatingRepository,
    private readonly favorites: FavoriteRepository,
    private readonly vectors: BookVectorRepository,
    private readonly genres: GenreRepository,
    private readonly authors: AuthorRepository
  ) {}

  /** `GET /api/me/recommendations`: perfil del usuario vs. catálogo. */
  async getRecommendations(
    userId: string,
    limit: number
  ): Promise<RecommendationSetDTO> {
    const context = await this.loadContext();
    const [userRatings, userFavorites] = await Promise.all([
      this.ratings.listAllByUser(userId),
      this.favorites.listAllByUser(userId)
    ]);

    const interacted = new Set<string>();
    const profileEntries: Array<{ vector: FeatureVector; weight: number }> = [];

    for (const rating of userRatings) {
      interacted.add(rating.bookId);
      const vector = context.vectors.get(rating.bookId);
      if (vector !== undefined) {
        // Una valoración de 5 pesa 1; una de 1 pesa 0,2.
        profileEntries.push({ vector, weight: rating.value / 5 });
      }
    }
    for (const favorite of userFavorites) {
      interacted.add(favorite.bookId);
      const vector = context.vectors.get(favorite.bookId);
      if (vector !== undefined) {
        profileEntries.push({ vector, weight: 1 });
      }
    }

    const profile = weightedSum(profileEntries);
    if (profile.size === 0) {
      return {
        strategy: 'popular',
        data: this.popular(context, limit, interacted)
      };
    }

    const scored: ScoredBook[] = [];
    for (const book of context.books) {
      if (interacted.has(book.id)) continue;
      const vector = context.vectors.get(book.id);
      if (vector === undefined) continue;
      const score = cosineSimilarity(profile, vector);
      if (score <= 0) continue;
      scored.push({
        book,
        score: roundScore(score),
        reasons: sharedReasons(profile, vector, context.names)
      });
    }

    if (scored.length === 0) {
      return {
        strategy: 'popular',
        data: this.popular(context, limit, interacted)
      };
    }

    scored.sort(compareScored);
    return {
      strategy: 'content-based',
      data: scored.slice(0, limit).map((item) => this.toSimilarDTO(item, context))
    };
  }

  /** `GET /api/books/:id/similar`: libros más afines a uno dado. */
  async getSimilar(bookId: string, limit: number): Promise<SimilarBookDTO[]> {
    const context = await this.loadContext();
    const target = context.books.find((book) => book.id === bookId);
    if (target === undefined) {
      throw HttpError.notFound('Libro no encontrado');
    }
    return this.rankSimilar(context, target, limit).map((item) =>
      this.toSimilarDTO(item, context)
    );
  }

  /** `GET /api/books/:id/graph`: grafo estrella libro → afines. */
  async getGraph(bookId: string, limit: number): Promise<GraphDTO> {
    const context = await this.loadContext();
    const target = context.books.find((book) => book.id === bookId);
    if (target === undefined) {
      throw HttpError.notFound('Libro no encontrado');
    }
    const ranked = this.rankSimilar(context, target, limit);
    const nodes: GraphNodeDTO[] = [
      this.toGraphNode(target, context),
      ...ranked.map((item) => this.toGraphNode(item.book, context))
    ];
    return {
      nodes,
      edges: ranked.map((item) => ({
        source: target.id,
        target: item.book.id,
        weight: item.score
      }))
    };
  }

  /** `GET /api/admin/recommender/status`: última reconstrucción o estado actual. */
  async getStatus(): Promise<RebuildStatus> {
    const latest =
      this.latestJobId === null ? undefined : this.jobs.get(this.latestJobId);
    if (latest !== undefined && latest.state === 'running') return { ...latest };

    const books = await this.books.findAll();
    const stale = books.filter((book) => book.vectorStale).length;
    if (latest !== undefined && stale === 0) return { ...latest };

    return {
      jobId: latest?.jobId ?? 'idle',
      state: stale > 0 ? 'pending' : 'completed',
      processed: books.length - stale,
      total: books.length,
      ...(latest?.finishedAt !== undefined ? { finishedAt: latest.finishedAt } : {})
    };
  }

  /** `GET /api/admin/recommender/rebuild/:jobId`. */
  async getRebuildStatus(jobId: string): Promise<RebuildStatus> {
    const status = this.jobs.get(jobId);
    if (status === undefined) {
      throw HttpError.notFound('Trabajo de reconstrucción no encontrado');
    }
    return { ...status };
  }

  /**
   * `POST /api/admin/recommender/rebuild`: recalcula y persiste los vectores
   * de todo el catálogo y marca los libros como no obsoletos.
   */
  async rebuild(): Promise<RebuildStatus> {
    const books = await this.books.findAll();
    const idf = buildCorpusIdf(books);
    const status: RebuildStatus = {
      jobId: randomUUID(),
      state: 'running',
      processed: 0,
      total: books.length,
      startedAt: new Date().toISOString()
    };
    this.registerJob(status);

    try {
      const entries = books.map((book) => ({
        bookId: book.id,
        vector: buildBookVector(book, idf)
      }));
      await this.vectors.upsertMany(entries);
      await this.books.markVectorsFresh(books.map((book) => book.id));
      status.processed = books.length;
      status.state = 'completed';
      status.finishedAt = new Date().toISOString();
    } catch (error) {
      status.state = 'failed';
      status.error = error instanceof Error ? error.message : String(error);
      status.finishedAt = new Date().toISOString();
    }

    return { ...status };
  }

  private registerJob(status: RebuildStatus): void {
    this.jobs.set(status.jobId, status);
    this.latestJobId = status.jobId;
    if (this.jobs.size > MAX_JOBS) {
      const oldest = this.jobs.keys().next().value;
      if (typeof oldest === 'string') this.jobs.delete(oldest);
    }
  }

  private async loadContext(): Promise<RecommenderContext> {
    const [books, genres, authors, storedVectors] = await Promise.all([
      this.books.findAll(),
      this.genres.findAll(),
      this.authors.findAll(),
      this.vectors.findAll()
    ]);

    const idf = buildCorpusIdf(books);
    const storedByBook = new Map(
      storedVectors.map((stored) => [stored.bookId, stored.vector])
    );
    const vectors = new Map<string, FeatureVector>();
    for (const book of books) {
      const stored = storedByBook.get(book.id);
      if (!book.vectorStale && stored !== undefined) {
        vectors.set(book.id, stored);
        continue;
      }
      // Vector obsoleto o inexistente: se calcula al vuelo con el corpus actual.
      vectors.set(book.id, buildBookVector(book, idf));
    }

    const genreNames = new Map(genres.map((genre) => [genre.id, genre.name]));
    const authorNames = new Map(authors.map((author) => [author.id, author.name]));
    return {
      books,
      vectors,
      names: { genres: genreNames, authors: authorNames },
      genreNames
    };
  }

  private rankSimilar(
    context: RecommenderContext,
    target: Book,
    limit: number
  ): ScoredBook[] {
    const targetVector = context.vectors.get(target.id);
    if (targetVector === undefined) return [];
    const scored: ScoredBook[] = [];
    for (const book of context.books) {
      if (book.id === target.id) continue;
      const vector = context.vectors.get(book.id);
      if (vector === undefined) continue;
      const score = cosineSimilarity(targetVector, vector);
      if (score <= 0) continue;
      scored.push({
        book,
        score: roundScore(score),
        reasons: sharedReasons(targetVector, vector, context.names)
      });
    }
    scored.sort(compareScored);
    return scored.slice(0, limit);
  }

  private popular(
    context: RecommenderContext,
    limit: number,
    excluded: ReadonlySet<string>
  ): SimilarBookDTO[] {
    return context.books
      .filter((book) => !excluded.has(book.id))
      .sort((left, right) => {
        const averageDelta = average(right) - average(left);
        if (averageDelta !== 0) return averageDelta;
        if (right.ratingCount !== left.ratingCount) {
          return right.ratingCount - left.ratingCount;
        }
        return left.title.localeCompare(right.title);
      })
      .slice(0, limit)
      .map((book) => ({
        book: this.toRecommenderBook(book, context),
        score: 0,
        reasons: []
      }));
  }

  private toSimilarDTO(
    item: ScoredBook,
    context: RecommenderContext
  ): SimilarBookDTO {
    return {
      book: this.toRecommenderBook(item.book, context),
      score: item.score,
      reasons: item.reasons
    };
  }

  private toRecommenderBook(
    book: Book,
    context: RecommenderContext
  ): RecommenderBookDTO {
    const dto: RecommenderBookDTO = {
      id: book.id,
      title: book.title,
      averageRating: average(book)
    };
    if (book.coverUrl !== undefined) dto.coverUrl = book.coverUrl;
    const mainGenreId = book.genreIds[0];
    if (mainGenreId !== undefined) {
      const name = context.genreNames.get(mainGenreId);
      if (name !== undefined) dto.mainGenre = name;
    }
    return dto;
  }

  private toGraphNode(book: Book, context: RecommenderContext): GraphNodeDTO {
    const node: GraphNodeDTO = { id: book.id, title: book.title };
    const mainGenreId = book.genreIds[0];
    if (mainGenreId !== undefined) {
      const name = context.genreNames.get(mainGenreId);
      if (name !== undefined) node.mainGenre = name;
    }
    return node;
  }
}
