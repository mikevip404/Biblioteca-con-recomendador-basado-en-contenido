import type { Document } from 'mongodb';
import type { Migration } from '../migrate.js';

/**
 * Valoraciones (1–5). El índice único (userId, bookId) garantiza que un
 * usuario valora cada libro una sola vez.
 */
const ratingsValidator: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'bookId', 'rating'],
    properties: {
      userId: { bsonType: 'objectId' },
      bookId: { bsonType: 'objectId' },
      rating: { bsonType: 'number', minimum: 1, maximum: 5 },
      review: { bsonType: 'string' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  }
};

export const migration005CreateRatings: Migration = {
  version: 5,
  name: '005_create_ratings',
  up: async (db) => {
    await db.ensureCollection('ratings', ratingsValidator);
    await db.ensureIndex(
      'ratings',
      { userId: 1, bookId: 1 },
      { unique: true, name: 'ratings_user_book_unique' }
    );
    await db.ensureIndex('ratings', { userId: 1 }, { name: 'ratings_user' });
    await db.ensureIndex('ratings', { bookId: 1 }, { name: 'ratings_book' });
  }
};
