import { ObjectId, type Document } from 'mongodb';
import type { MongoDatabase } from '../db/mongo.js';
import type { FeatureVector } from '../utils/recommender.js';

/** Vector persistido de un libro para el recomendador. */
export interface StoredBookVector {
  bookId: string;
  vector: FeatureVector;
  dimensions: number;
  updatedAt: Date;
}

export interface UpsertBookVectorData {
  bookId: string;
  vector: FeatureVector;
}

/**
 * Puerto de persistencia de los vectores del recomendador. Los vectores se
 * reconstruyen con `POST /api/admin/recommender/rebuild`; mientras un libro
 * esté marcado como `vectorStale`, el servicio lo calcula al vuelo.
 */
export interface BookVectorRepository {
  findAll(): Promise<StoredBookVector[]>;
  findByBookId(bookId: string): Promise<StoredBookVector | null>;
  upsertMany(entries: UpsertBookVectorData[]): Promise<void>;
  deleteByBookId(bookId: string): Promise<void>;
}

function toObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function toVector(value: unknown): FeatureVector | null {
  if (!Array.isArray(value)) return null;
  const vector: FeatureVector = new Map();
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const token = (entry as { token?: unknown }).token;
    const weight = (entry as { weight?: unknown }).weight;
    if (typeof token !== 'string' || typeof weight !== 'number') continue;
    vector.set(token, weight);
  }
  return vector;
}

function toStoredVector(doc: Document): StoredBookVector | null {
  const id = doc['_id'];
  if (id === null || id === undefined) return null;
  const vector = toVector(doc['features']);
  if (vector === null) return null;
  return {
    bookId: String(id),
    vector,
    dimensions: vector.size,
    updatedAt: (doc['updatedAt'] as Date | undefined) ?? new Date(0)
  };
}

function serialize(vector: FeatureVector): Array<{ token: string; weight: number }> {
  return [...vector.entries()].map(([token, weight]) => ({ token, weight }));
}

export class MongoBookVectorRepository implements BookVectorRepository {
  constructor(private readonly db: MongoDatabase) {}

  async findAll(): Promise<StoredBookVector[]> {
    const docs = await this.db.find('book_vectors');
    const vectors: StoredBookVector[] = [];
    for (const doc of docs) {
      const stored = toStoredVector(doc);
      if (stored !== null) vectors.push(stored);
    }
    return vectors;
  }

  async findByBookId(bookId: string): Promise<StoredBookVector | null> {
    const objectId = toObjectId(bookId);
    if (objectId === null) return null;
    const doc = await this.db.findOne('book_vectors', { _id: objectId });
    return doc === null ? null : toStoredVector(doc);
  }

  async upsertMany(entries: UpsertBookVectorData[]): Promise<void> {
    const updatedAt = new Date();
    for (const entry of entries) {
      const objectId = toObjectId(entry.bookId);
      if (objectId === null) continue;
      await this.db.updateOne(
        'book_vectors',
        { _id: objectId },
        {
          $set: {
            features: serialize(entry.vector),
            dimensions: entry.vector.size,
            updatedAt
          }
        },
        { upsert: true }
      );
    }
  }

  async deleteByBookId(bookId: string): Promise<void> {
    const objectId = toObjectId(bookId);
    if (objectId === null) return;
    await this.db.deleteOne('book_vectors', { _id: objectId });
  }
}
