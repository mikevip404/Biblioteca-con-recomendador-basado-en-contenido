import { ObjectId, type Document } from 'mongodb';
import type { MongoDatabase } from '../db/mongo.js';
import type { Genre } from '../types/catalog.js';

export interface CreateGenreData {
  name: string;
  slug: string;
  description?: string;
}

export type UpdateGenreData = Partial<CreateGenreData>;

/**
 * Puerto del repositorio de géneros. Los ids viajan como string; la
 * conversión a ObjectId vive solo en la implementación Mongo.
 */
export interface GenreRepository {
  findById(id: string): Promise<Genre | null>;
  findByIds(ids: string[]): Promise<Genre[]>;
  findByName(name: string): Promise<Genre | null>;
  findBySlug(slug: string): Promise<Genre | null>;
  findAll(): Promise<Genre[]>;
  create(data: CreateGenreData): Promise<Genre>;
  updateById(id: string, patch: UpdateGenreData): Promise<Genre | null>;
  deleteById(id: string): Promise<boolean>;
}

function toObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function toGenre(doc: Document): Genre | null {
  const id = doc['_id'];
  if (id === null || id === undefined) return null;
  const genre: Genre = {
    id: String(id),
    name: doc['name'] as string,
    slug: doc['slug'] as string,
    createdAt: doc['createdAt'] as Date,
    updatedAt: doc['updatedAt'] as Date
  };
  const description = doc['description'] as string | undefined;
  if (description !== undefined) genre.description = description;
  return genre;
}

function toGenres(docs: Document[]): Genre[] {
  const genres: Genre[] = [];
  for (const doc of docs) {
    const genre = toGenre(doc);
    if (genre !== null) genres.push(genre);
  }
  return genres;
}

export class MongoGenreRepository implements GenreRepository {
  constructor(private readonly db: MongoDatabase) {}

  async findById(id: string): Promise<Genre | null> {
    const objectId = toObjectId(id);
    if (objectId === null) return null;
    const doc = await this.db.findOne('genres', { _id: objectId });
    return doc === null ? null : toGenre(doc);
  }

  async findByIds(ids: string[]): Promise<Genre[]> {
    const objectIds = ids
      .map(toObjectId)
      .filter((value): value is ObjectId => value !== null);
    if (objectIds.length === 0) return [];
    const docs = await this.db.find('genres', { _id: { $in: objectIds } });
    return toGenres(docs);
  }

  async findByName(name: string): Promise<Genre | null> {
    const doc = await this.db.findOne('genres', { name });
    return doc === null ? null : toGenre(doc);
  }

  async findBySlug(slug: string): Promise<Genre | null> {
    const doc = await this.db.findOne('genres', { slug });
    return doc === null ? null : toGenre(doc);
  }

  async findAll(): Promise<Genre[]> {
    const docs = await this.db.find('genres', {}, { sort: { name: 1 } });
    return toGenres(docs);
  }

  async create(data: CreateGenreData): Promise<Genre> {
    const now = new Date();
    await this.db.insertOne('genres', {
      name: data.name,
      slug: data.slug,
      ...(data.description !== undefined ? { description: data.description } : {}),
      createdAt: now,
      updatedAt: now
    });
    const genre = await this.findBySlug(data.slug);
    if (genre === null) {
      throw new Error('No se pudo leer el género recién creado');
    }
    return genre;
  }

  async updateById(id: string, patch: UpdateGenreData): Promise<Genre | null> {
    const objectId = toObjectId(id);
    if (objectId === null) return null;
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) set['name'] = patch.name;
    if (patch.slug !== undefined) set['slug'] = patch.slug;
    if (patch.description !== undefined) set['description'] = patch.description;
    await this.db.updateOne('genres', { _id: objectId }, { $set: set });
    return this.findById(id);
  }

  async deleteById(id: string): Promise<boolean> {
    const objectId = toObjectId(id);
    if (objectId === null) return false;
    const deleted = await this.db.deleteOne('genres', { _id: objectId });
    return deleted > 0;
  }
}
