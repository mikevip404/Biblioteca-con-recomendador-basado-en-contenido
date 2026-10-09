import { ObjectId, type Document } from 'mongodb';
import type { MongoDatabase } from '../db/mongo.js';
import type { Author } from '../types/catalog.js';

export interface CreateAuthorData {
  name: string;
  bio?: string;
  birthYear?: number;
  country?: string;
}

export type UpdateAuthorData = Partial<CreateAuthorData>;

/**
 * Puerto del repositorio de autores. Los ids viajan como string; la
 * conversión a ObjectId vive solo en la implementación Mongo.
 */
export interface AuthorRepository {
  findById(id: string): Promise<Author | null>;
  findByIds(ids: string[]): Promise<Author[]>;
  findByName(name: string): Promise<Author | null>;
  findAll(): Promise<Author[]>;
  create(data: CreateAuthorData): Promise<Author>;
  updateById(id: string, patch: UpdateAuthorData): Promise<Author | null>;
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

function toAuthor(doc: Document): Author | null {
  const id = doc['_id'];
  if (id === null || id === undefined) return null;
  const author: Author = {
    id: String(id),
    name: doc['name'] as string,
    createdAt: doc['createdAt'] as Date,
    updatedAt: doc['updatedAt'] as Date
  };
  const bio = doc['bio'] as string | undefined;
  const birthYear = doc['birthYear'] as number | undefined;
  const country = doc['country'] as string | undefined;
  if (bio !== undefined) author.bio = bio;
  if (birthYear !== undefined) author.birthYear = birthYear;
  if (country !== undefined) author.country = country;
  return author;
}

function toAuthors(docs: Document[]): Author[] {
  const authors: Author[] = [];
  for (const doc of docs) {
    const author = toAuthor(doc);
    if (author !== null) authors.push(author);
  }
  return authors;
}

export class MongoAuthorRepository implements AuthorRepository {
  constructor(private readonly db: MongoDatabase) {}

  async findById(id: string): Promise<Author | null> {
    const objectId = toObjectId(id);
    if (objectId === null) return null;
    const doc = await this.db.findOne('authors', { _id: objectId });
    return doc === null ? null : toAuthor(doc);
  }

  async findByIds(ids: string[]): Promise<Author[]> {
    const objectIds = ids
      .map(toObjectId)
      .filter((value): value is ObjectId => value !== null);
    if (objectIds.length === 0) return [];
    const docs = await this.db.find('authors', { _id: { $in: objectIds } });
    return toAuthors(docs);
  }

  async findByName(name: string): Promise<Author | null> {
    const doc = await this.db.findOne('authors', { name });
    return doc === null ? null : toAuthor(doc);
  }

  async findAll(): Promise<Author[]> {
    const docs = await this.db.find('authors', {}, { sort: { name: 1 } });
    return toAuthors(docs);
  }

  async create(data: CreateAuthorData): Promise<Author> {
    const now = new Date();
    await this.db.insertOne('authors', {
      name: data.name,
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      ...(data.birthYear !== undefined ? { birthYear: data.birthYear } : {}),
      ...(data.country !== undefined ? { country: data.country } : {}),
      createdAt: now,
      updatedAt: now
    });
    const author = await this.findByName(data.name);
    if (author === null) {
      throw new Error('No se pudo leer el autor recién creado');
    }
    return author;
  }

  async updateById(id: string, patch: UpdateAuthorData): Promise<Author | null> {
    const objectId = toObjectId(id);
    if (objectId === null) return null;
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) set['name'] = patch.name;
    if (patch.bio !== undefined) set['bio'] = patch.bio;
    if (patch.birthYear !== undefined) set['birthYear'] = patch.birthYear;
    if (patch.country !== undefined) set['country'] = patch.country;
    await this.db.updateOne('authors', { _id: objectId }, { $set: set });
    return this.findById(id);
  }

  async deleteById(id: string): Promise<boolean> {
    const objectId = toObjectId(id);
    if (objectId === null) return false;
    const deleted = await this.db.deleteOne('authors', { _id: objectId });
    return deleted > 0;
  }
}
