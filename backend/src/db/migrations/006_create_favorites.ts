import type { Document } from 'mongodb';
import type { Migration } from '../migrate.js';

/** Favoritos. El índice único compuesto impide favoritar dos veces el mismo libro. */
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

export const migration006CreateFavorites: Migration = {
  version: 6,
  name: '006_create_favorites',
  up: async (db) => {
    await db.ensureCollection('favorites', favoritesValidator);
    await db.ensureIndex(
      'favorites',
      { userId: 1, bookId: 1 },
      { unique: true, name: 'favorites_user_book_unique' }
    );
    await db.ensureIndex(
      'favorites',
      { bookId: 1 },
      { name: 'favorites_book' }
    );
  }
};
