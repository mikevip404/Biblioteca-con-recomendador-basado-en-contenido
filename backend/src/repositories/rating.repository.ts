import { ObjectId, type Document } from 'mongodb';
import type { MongoDatabase } from '../db/mongo.js';
import type { Rating } from '../types/ratings.js';
import { buildPagination, type Pagination } from './query.builder.js';

export interface RatingListResult {
  items: Rating[];
  total: number;
  pagination: Pagination;
}

/**
 * Puerto del repositorio de valoraciones. La coherencia de los contadores
 * del libro y las transacciones las orquesta el servicio, no el repositorio.
 */
export interface RatingRepository {
  findByUserAndBook(userId: string, bookId: string): Promise<Rating | null>;
  findById(id: string): Promise<Rating | null>;
  /** Id del dueño de la valoración (para `requireOwnership`). */
  findOwnerId(id: string): Promise<string | null>;
  insert(
    userId: string,
    bookId: string,
    value: number,
    comment?: string
  ): Promise<Rating>;
  updateById(id: string, value: number, comment?: string): Promise<Rating | null>;
  deleteById(id: string): Promise<boolean>;
  listByBook(bookId: string, page: number, limit: number): Promise<RatingListResult>;
  listByUser(userId: string, page: number, limit: number): Promise<RatingListResult>;
  countByBook(bookId: string): Promise<number>;
}

function toObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function toRating(doc: Document): Rating | null {
  const id = doc['_id'];
  const userId = doc['userId'];
  const bookId = doc['bookId'];
  if (id === null || id === undefined) return null;
  const rating: Rating = {
    id: String(id),
    userId: userId === null || userId === undefined ? '' : String(userId),
    bookId: bookId === null || bookId === undefined ? '' : String(bookId),
    value: (doc['value'] as number | undefined) ?? 0,
    createdAt: doc['createdAt'] as Date,
    updatedAt: doc['updatedAt'] as Date
  };
  const comment = doc['comment'] as string | undefined;
  if (comment !== undefined) rating.comment = comment;
  return rating;
}

function toRatings(docs: Document[]): Rating[] {
  const ratings: Rating[] = [];
  for (const doc of docs) {
    const rating = toRating(doc);
    if (rating !== null) ratings.push(rating);
  }
  return ratings;
}

export class MongoRatingRepository implements RatingRepository {
  constructor(private readonly db: MongoDatabase) {}

  async findByUserAndBook(userId: string, bookId: string): Promise<Rating | null> {
    const userObjectId = toObjectId(userId);
    const bookObjectId = toObjectId(bookId);
    if (userObjectId === null || bookObjectId === null) return null;
    const doc = await this.db.findOne('ratings', {
      userId: userObjectId,
      bookId: bookObjectId
    });
    return doc === null ? null : toRating(doc);
  }

  async findById(id: string): Promise<Rating | null> {
    const objectId = toObjectId(id);
    if (objectId === null) return null;
    const doc = await this.db.findOne('ratings', { _id: objectId });
    return doc === null ? null : toRating(doc);
  }

  async findOwnerId(id: string): Promise<string | null> {
    const rating = await this.findById(id);
    return rating === null ? null : rating.userId;
  }

  async insert(
    userId: string,
    bookId: string,
    value: number,
    comment?: string
  ): Promise<Rating> {
    const userObjectId = toObjectId(userId);
    const bookObjectId = toObjectId(bookId);
    if (userObjectId === null || bookObjectId === null) {
      throw new Error('Referencias inválidas al crear la valoración');
    }
    const now = new Date();
    const id = await this.db.insertOne('ratings', {
      userId: userObjectId,
      bookId: bookObjectId,
      value,
      ...(comment !== undefined ? { comment } : {}),
      createdAt: now,
      updatedAt: now
    });
    const rating = await this.findById(id);
    if (rating === null) {
      throw new Error('No se pudo leer la valoración recién creada');
    }
    return rating;
  }

  async updateById(
    id: string,
    value: number,
    comment?: string
  ): Promise<Rating | null> {
    const objectId = toObjectId(id);
    if (objectId === null) return null;
    const update: { $set: Document; $unset?: Document } = {
      $set: { value, updatedAt: new Date() }
    };
    if (comment !== undefined) {
      update.$set['comment'] = comment;
    } else {
      update.$unset = { comment: '' };
    }
    await this.db.updateOne('ratings', { _id: objectId }, update);
    return this.findById(id);
  }

  async deleteById(id: string): Promise<boolean> {
    const objectId = toObjectId(id);
    if (objectId === null) return false;
    return (await this.db.deleteOne('ratings', { _id: objectId })) > 0;
  }

  async listByBook(
    bookId: string,
    page: number,
    limit: number
  ): Promise<RatingListResult> {
    const bookObjectId = toObjectId(bookId);
    const pagination = buildPagination(page, limit);
    if (bookObjectId === null) {
      return { items: [], total: 0, pagination };
    }
    const filter = { bookId: bookObjectId };
    const [docs, total] = await Promise.all([
      this.db.find('ratings', filter, {
        sort: { createdAt: -1, _id: 1 },
        skip: pagination.skip,
        limit: pagination.limit
      }),
      this.db.countDocuments('ratings', filter)
    ]);
    return { items: toRatings(docs), total, pagination };
  }

  async listByUser(
    userId: string,
    page: number,
    limit: number
  ): Promise<RatingListResult> {
    const userObjectId = toObjectId(userId);
    const pagination = buildPagination(page, limit);
    if (userObjectId === null) {
      return { items: [], total: 0, pagination };
    }
    const filter = { userId: userObjectId };
    const [docs, total] = await Promise.all([
      this.db.find('ratings', filter, {
        sort: { createdAt: -1, _id: 1 },
        skip: pagination.skip,
        limit: pagination.limit
      }),
      this.db.countDocuments('ratings', filter)
    ]);
    return { items: toRatings(docs), total, pagination };
  }

  async countByBook(bookId: string): Promise<number> {
    const bookObjectId = toObjectId(bookId);
    if (bookObjectId === null) return 0;
    return this.db.countDocuments('ratings', { bookId: bookObjectId });
  }
}
