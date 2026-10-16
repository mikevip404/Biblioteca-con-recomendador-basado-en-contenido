import { ObjectId, type Document } from 'mongodb';
import type { MongoDatabase } from '../db/mongo.js';
import type { Favorite } from '../types/ratings.js';
import { buildPagination, type Pagination } from './query.builder.js';

export interface FavoriteListResult {
  items: Favorite[];
  total: number;
  pagination: Pagination;
}

/** Puerto del repositorio de favoritos (operaciones idempotentes). */
export interface FavoriteRepository {
  add(userId: string, bookId: string): Promise<void>;
  remove(userId: string, bookId: string): Promise<boolean>;
  exists(userId: string, bookId: string): Promise<boolean>;
  listByUser(userId: string, page: number, limit: number): Promise<FavoriteListResult>;
}

function toObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function toFavorite(doc: Document): Favorite | null {
  const id = doc['_id'];
  const userId = doc['userId'];
  const bookId = doc['bookId'];
  if (id === null || id === undefined) return null;
  return {
    id: String(id),
    userId: userId === null || userId === undefined ? '' : String(userId),
    bookId: bookId === null || bookId === undefined ? '' : String(bookId),
    createdAt: doc['createdAt'] as Date
  };
}

export class MongoFavoriteRepository implements FavoriteRepository {
  constructor(private readonly db: MongoDatabase) {}

  async add(userId: string, bookId: string): Promise<void> {
    const userObjectId = toObjectId(userId);
    const bookObjectId = toObjectId(bookId);
    if (userObjectId === null || bookObjectId === null) {
      throw new Error('Referencias inválidas al marcar favorito');
    }
    // Upsert sobre el índice único (userId, bookId): marcar dos veces no duplica.
    await this.db.updateOne(
      'favorites',
      { userId: userObjectId, bookId: bookObjectId },
      { $set: { createdAt: new Date() } },
      { upsert: true }
    );
  }

  async remove(userId: string, bookId: string): Promise<boolean> {
    const userObjectId = toObjectId(userId);
    const bookObjectId = toObjectId(bookId);
    if (userObjectId === null || bookObjectId === null) return false;
    const deleted = await this.db.deleteOne('favorites', {
      userId: userObjectId,
      bookId: bookObjectId
    });
    return deleted > 0;
  }

  async exists(userId: string, bookId: string): Promise<boolean> {
    const userObjectId = toObjectId(userId);
    const bookObjectId = toObjectId(bookId);
    if (userObjectId === null || bookObjectId === null) return false;
    const found = await this.db.findOne('favorites', {
      userId: userObjectId,
      bookId: bookObjectId
    });
    return found !== null;
  }

  async listByUser(
    userId: string,
    page: number,
    limit: number
  ): Promise<FavoriteListResult> {
    const userObjectId = toObjectId(userId);
    const pagination = buildPagination(page, limit);
    if (userObjectId === null) {
      return { items: [], total: 0, pagination };
    }
    const filter = { userId: userObjectId };
    const [docs, total] = await Promise.all([
      this.db.find('favorites', filter, {
        sort: { createdAt: -1, _id: 1 },
        skip: pagination.skip,
        limit: pagination.limit
      }),
      this.db.countDocuments('favorites', filter)
    ]);
    const items: Favorite[] = [];
    for (const doc of docs) {
      const favorite = toFavorite(doc);
      if (favorite !== null) items.push(favorite);
    }
    return { items, total, pagination };
  }
}
