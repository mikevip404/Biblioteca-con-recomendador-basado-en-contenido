import type { Document } from 'mongodb';
import type { Migration } from '../migrate.js';
import { slugify } from '../../utils/slug.js';

/**
 * Catálogo (Fase 3).
 *
 * - Crea la colección `authors`.
 * - Evoluciona `genres` añadiendo `slug` y `description` (collMod, como la
 *   008, sin editar la migración 002 ya aplicada) y rellena el slug de los
 *   géneros existentes antes de crear el índice único.
 * - Evoluciona `books`: `author` pasa de string a referencia (`ObjectId`),
 *   `genres` se embebe como arreglo de referencias y se añaden `tags`,
 *   `language`, `isbn`, `coverUrl`, `createdBy` y `vectorStale` (Fase 5).
 */
const authorsValidator: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name'],
    properties: {
      name: { bsonType: 'string' },
      bio: { bsonType: 'string' },
      birthYear: { bsonType: 'number', minimum: 0, maximum: 2100 },
      country: { bsonType: 'string' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  }
};

const genresValidatorV2: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'slug'],
    properties: {
      name: { bsonType: 'string' },
      slug: { bsonType: 'string' },
      description: { bsonType: 'string' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  }
};

const booksValidatorV3: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['title', 'author', 'genres', 'createdBy'],
    properties: {
      title: { bsonType: 'string' },
      description: { bsonType: 'string' },
      author: { bsonType: 'objectId' },
      genres: {
        bsonType: 'array',
        minItems: 1,
        items: { bsonType: 'objectId' }
      },
      tags: { bsonType: 'array', items: { bsonType: 'string' } },
      publishedYear: { bsonType: 'number', minimum: 0, maximum: 2100 },
      pages: { bsonType: 'number', minimum: 1 },
      language: { bsonType: 'string' },
      isbn: { bsonType: 'string' },
      coverUrl: { bsonType: 'string' },
      createdBy: { bsonType: 'objectId' },
      vectorStale: { bsonType: 'bool' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  }
};

export const migration009CatalogSchema: Migration = {
  version: 9,
  name: '009_catalog_schema',
  up: async (db) => {
    await db.ensureCollection('authors', authorsValidator);
    await db.ensureIndex(
      'authors',
      { name: 1 },
      { unique: true, name: 'authors_name_unique' }
    );

    await db.ensureCollection('genres', genresValidatorV2);
    const now = new Date();
    const genres = await db.find('genres');
    for (const genre of genres) {
      const currentSlug = genre['slug'];
      if (typeof currentSlug === 'string' && currentSlug !== '') continue;
      const id = genre['_id'];
      if (id === null || id === undefined) continue;
      await db.updateOne(
        'genres',
        { _id: id },
        { $set: { slug: slugify(String(genre['name'] ?? '')), updatedAt: now } }
      );
    }
    await db.ensureIndex(
      'genres',
      { slug: 1 },
      { unique: true, name: 'genres_slug_unique' }
    );

    await db.ensureCollection('books', booksValidatorV3);
    await db.ensureIndex('books', { author: 1 }, { name: 'books_author' });
  }
};
