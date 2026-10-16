import type { Document } from 'mongodb';
import type { Migration } from '../migrate.js';

/**
 * Valoraciones y favoritos (Fase 4).
 *
 * - Migra los campos legados `rating`→`value` y `review`→`comment`.
 * - Endurece el validador de `ratings` (value entero 1–5, comment ≤500).
 * - Añade a `books` los contadores denormalizados `ratingCount`/`ratingSum`
 *   (usados para el `averageRating` virtual) y los inicializa a 0.
 * - Índices de listado por autor/fecha para ratings y favoritos.
 */
const ratingsValidatorV2: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'bookId', 'value'],
    properties: {
      userId: { bsonType: 'objectId' },
      bookId: { bsonType: 'objectId' },
      value: { bsonType: 'int', minimum: 1, maximum: 5 },
      comment: { bsonType: 'string', maxLength: 500 },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  }
};

const favoritesValidator: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'bookId'],
    properties: {
      userId: { bsonType: 'objectId' },
      bookId: { bsonType: 'objectId' },
      createdAt: { bsonType: 'date' }
    }
  }
};

const booksValidatorV4: Document = {
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
      ratingCount: { bsonType: 'int', minimum: 0 },
      ratingSum: { bsonType: 'int', minimum: 0 },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  }
};

export const migration011RatingsFavorites: Migration = {
  version: 11,
  name: '011_ratings_favorites',
  up: async (db) => {
    // 1) Datos legados antes de endurecer el validador.
    const ratings = await db.find('ratings');
    for (const rating of ratings) {
      const id = rating['_id'];
      if (id === null || id === undefined) continue;
      if (rating['value'] === undefined && rating['rating'] !== undefined) {
        await db.updateOne('ratings', { _id: id }, { $set: { value: rating['rating'] } });
      }
      if (rating['comment'] === undefined && rating['review'] !== undefined) {
        await db.updateOne('ratings', { _id: id }, { $set: { comment: rating['review'] } });
      }
    }

    await db.ensureCollection('ratings', ratingsValidatorV2);
    await db.ensureIndex(
      'ratings',
      { bookId: 1, createdAt: -1 },
      { name: 'ratings_book_createdAt' }
    );
    await db.ensureIndex(
      'ratings',
      { userId: 1, createdAt: -1 },
      { name: 'ratings_user_createdAt' }
    );

    await db.ensureCollection('favorites', favoritesValidator);
    await db.ensureIndex(
      'favorites',
      { userId: 1, createdAt: -1 },
      { name: 'favorites_user_createdAt' }
    );

    await db.ensureCollection('books', booksValidatorV4);

    // 2) Inicializa los contadores de los libros existentes (idempotente).
    const books = await db.find('books');
    for (const book of books) {
      const id = book['_id'];
      if (id === null || id === undefined) continue;
      if (book['ratingCount'] === undefined || book['ratingSum'] === undefined) {
        await db.updateOne(
          'books',
          { _id: id },
          { $set: { ratingCount: 0, ratingSum: 0 } }
        );
      }
    }
  }
};
