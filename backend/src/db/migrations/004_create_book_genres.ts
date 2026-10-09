import type { Document } from 'mongodb';
import type { Migration } from '../migrate.js';

/**
 * Relación muchos-a-muchos libro ↔ género.
 * El índice único compuesto impide duplicados (equivale a la PK compuesta SQL).
 */
const bookGenresValidator: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['bookId', 'genreId'],
    properties: {
      bookId: { bsonType: 'objectId' },
      genreId: { bsonType: 'objectId' }
    }
  }
};

export const migration004CreateBookGenres: Migration = {
  version: 4,
  name: '004_create_book_genres',
  up: async (db) => {
    await db.ensureCollection('book_genres', bookGenresValidator);
    await db.ensureIndex(
      'book_genres',
      { bookId: 1, genreId: 1 },
      { unique: true, name: 'book_genres_unique' }
    );
    await db.ensureIndex(
      'book_genres',
      { genreId: 1 },
      { name: 'book_genres_genre' }
    );
  }
};
