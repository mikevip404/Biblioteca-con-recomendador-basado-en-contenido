import { ObjectId, type Document } from 'mongodb';
import type { MongoDatabase } from '../db/mongo.js';
import type {
  Book,
  BookFilter,
  BookSortField,
  SortOrder
} from '../types/catalog.js';
import {
  averageRatingExpression,
  buildBookFilter,
  buildPagination,
  buildSort,
  type Pagination
} from './query.builder.js';

export interface CreateBookData {
  title: string;
  description?: string;
  authorId: string;
  genreIds: string[];
  tags: string[];
  publishedYear?: number;
  pages?: number;
  language?: string;
  isbn?: string;
  coverUrl?: string;
  createdBy: string;
}

export interface UpdateBookData {
  title?: string;
  description?: string;
  authorId?: string;
  genreIds?: string[];
  tags?: string[];
  publishedYear?: number;
  pages?: number;
  language?: string;
  isbn?: string;
  coverUrl?: string;
  /** Marca de reindexado del recomendador (Fase 5). */
  vectorStale?: boolean;
}

export interface BookListSpec {
  filter: BookFilter;
  sort: BookSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

export interface BookListResult {
  items: Book[];
  total: number;
  pagination: Pagination;
}

/**
 * Puerto del repositorio de libros. El armado de filtros, orden y
 * paginación vive en `query.builder.ts` (reutilizable y tipado).
 */
export interface BookRepository {
  findById(id: string): Promise<Book | null>;
  /** Libros por id (para poblar los listados "míos"). */
  findByIds(ids: string[]): Promise<Book[]>;
  findByIsbn(isbn: string): Promise<Book | null>;
  findMany(spec: BookListSpec): Promise<BookListResult>;
  create(data: CreateBookData): Promise<Book>;
  updateById(id: string, patch: UpdateBookData): Promise<Book | null>;
  deleteById(id: string): Promise<boolean>;
  countByAuthor(authorId: string): Promise<number>;
  countByGenre(genreId: string): Promise<number>;
  /** Ajusta `ratingCount`/`ratingSum` de forma atómica (`$inc`). */
  applyRatingDelta(bookId: string, countDelta: number, sumDelta: number): Promise<void>;
}

function toObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function toBook(doc: Document): Book | null {
  const id = doc['_id'];
  const author = doc['author'];
  const createdBy = doc['createdBy'];
  if (id === null || id === undefined) return null;
  const book: Book = {
    id: String(id),
    title: doc['title'] as string,
    authorId: author === null || author === undefined ? '' : String(author),
    genreIds: toStringArray(doc['genres']),
    tags: toStringArray(doc['tags']),
    createdBy: createdBy === null || createdBy === undefined ? '' : String(createdBy),
    vectorStale: (doc['vectorStale'] as boolean | undefined) ?? true,
    ratingCount: (doc['ratingCount'] as number | undefined) ?? 0,
    ratingSum: (doc['ratingSum'] as number | undefined) ?? 0,
    createdAt: doc['createdAt'] as Date,
    updatedAt: doc['updatedAt'] as Date
  };
  const description = doc['description'] as string | undefined;
  const publishedYear = doc['publishedYear'] as number | undefined;
  const pages = doc['pages'] as number | undefined;
  const language = doc['language'] as string | undefined;
  const isbn = doc['isbn'] as string | undefined;
  const coverUrl = doc['coverUrl'] as string | undefined;
  if (description !== undefined) book.description = description;
  if (publishedYear !== undefined) book.publishedYear = publishedYear;
  if (pages !== undefined) book.pages = pages;
  if (language !== undefined) book.language = language;
  if (isbn !== undefined) book.isbn = isbn;
  if (coverUrl !== undefined) book.coverUrl = coverUrl;
  return book;
}

function toBooks(docs: Document[]): Book[] {
  const books: Book[] = [];
  for (const doc of docs) {
    const book = toBook(doc);
    if (book !== null) books.push(book);
  }
  return books;
}

export class MongoBookRepository implements BookRepository {
  constructor(private readonly db: MongoDatabase) {}

  async findById(id: string): Promise<Book | null> {
    const objectId = toObjectId(id);
    if (objectId === null) return null;
    const doc = await this.db.findOne('books', { _id: objectId });
    return doc === null ? null : toBook(doc);
  }

  async findByIds(ids: string[]): Promise<Book[]> {
    const objectIds = ids
      .map(toObjectId)
      .filter((value): value is ObjectId => value !== null);
    if (objectIds.length === 0) return [];
    const docs = await this.db.find('books', { _id: { $in: objectIds } });
    return toBooks(docs);
  }

  async findByIsbn(isbn: string): Promise<Book | null> {
    const doc = await this.db.findOne('books', { isbn });
    return doc === null ? null : toBook(doc);
  }

  async findMany(spec: BookListSpec): Promise<BookListResult> {
    const filter = buildBookFilter(spec.filter);
    const pagination = buildPagination(spec.page, spec.limit);

    // `averageRating` es virtual: solo se puede ordenar tras calcularlo.
    if (spec.sort === 'averageRating') {
      const direction = spec.order === 'asc' ? 1 : -1;
      const [docs, total] = await Promise.all([
        this.db.aggregate('books', [
          { $match: filter },
          { $addFields: { averageRating: averageRatingExpression } },
          { $sort: { averageRating: direction, _id: 1 } },
          { $skip: pagination.skip },
          { $limit: pagination.limit }
        ]),
        this.db.countDocuments('books', filter)
      ]);
      return { items: toBooks(docs), total, pagination };
    }

    const sort = buildSort(spec.sort, spec.order);
    const [docs, total] = await Promise.all([
      this.db.find('books', filter, {
        sort,
        skip: pagination.skip,
        limit: pagination.limit
      }),
      this.db.countDocuments('books', filter)
    ]);
    return { items: toBooks(docs), total, pagination };
  }

  async create(data: CreateBookData): Promise<Book> {
    const author = toObjectId(data.authorId);
    const createdBy = toObjectId(data.createdBy);
    if (author === null || createdBy === null) {
      throw new Error('Referencias inválidas al crear el libro');
    }
    const genreIds = data.genreIds
      .map(toObjectId)
      .filter((value): value is ObjectId => value !== null);
    const now = new Date();
    const id = await this.db.insertOne('books', {
      title: data.title,
      author,
      genres: genreIds,
      tags: data.tags,
      createdBy,
      vectorStale: true,
      ratingCount: 0,
      ratingSum: 0,
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.publishedYear !== undefined ? { publishedYear: data.publishedYear } : {}),
      ...(data.pages !== undefined ? { pages: data.pages } : {}),
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.isbn !== undefined ? { isbn: data.isbn } : {}),
      ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl } : {}),
      createdAt: now,
      updatedAt: now
    });
    const book = await this.findById(id);
    if (book === null) {
      throw new Error('No se pudo leer el libro recién creado');
    }
    return book;
  }

  async updateById(id: string, patch: UpdateBookData): Promise<Book | null> {
    const objectId = toObjectId(id);
    if (objectId === null) return null;
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.title !== undefined) set['title'] = patch.title;
    if (patch.description !== undefined) set['description'] = patch.description;
    if (patch.tags !== undefined) set['tags'] = patch.tags;
    if (patch.publishedYear !== undefined) set['publishedYear'] = patch.publishedYear;
    if (patch.pages !== undefined) set['pages'] = patch.pages;
    if (patch.language !== undefined) set['language'] = patch.language;
    if (patch.isbn !== undefined) set['isbn'] = patch.isbn;
    if (patch.coverUrl !== undefined) set['coverUrl'] = patch.coverUrl;
    if (patch.vectorStale !== undefined) set['vectorStale'] = patch.vectorStale;
    if (patch.authorId !== undefined) {
      const author = toObjectId(patch.authorId);
      if (author !== null) set['author'] = author;
    }
    if (patch.genreIds !== undefined) {
      set['genres'] = patch.genreIds
        .map(toObjectId)
        .filter((value): value is ObjectId => value !== null);
    }
    await this.db.updateOne('books', { _id: objectId }, { $set: set });
    return this.findById(id);
  }

  async deleteById(id: string): Promise<boolean> {
    const objectId = toObjectId(id);
    if (objectId === null) return false;
    const deleted = await this.db.deleteOne('books', { _id: objectId });
    return deleted > 0;
  }

  async countByAuthor(authorId: string): Promise<number> {
    const objectId = toObjectId(authorId);
    if (objectId === null) return 0;
    return this.db.countDocuments('books', { author: objectId });
  }

  async countByGenre(genreId: string): Promise<number> {
    const objectId = toObjectId(genreId);
    if (objectId === null) return 0;
    return this.db.countDocuments('books', { genres: objectId });
  }

  async applyRatingDelta(
    bookId: string,
    countDelta: number,
    sumDelta: number
  ): Promise<void> {
    const objectId = toObjectId(bookId);
    if (objectId === null) return;
    await this.db.updateOne(
      'books',
      { _id: objectId },
      { $inc: { ratingCount: countDelta, ratingSum: sumDelta } }
    );
  }
}
