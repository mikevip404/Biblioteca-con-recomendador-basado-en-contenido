import type { Document } from 'mongodb';
import type { Migration } from '../migrate.js';

/** Libros. `publishedYear` y `pages` se normalizan en el recomendador (Fase 4). */
const booksValidator: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['title', 'author', 'publishedYear', 'pages'],
    properties: {
      title: { bsonType: 'string' },
      author: { bsonType: 'string' },
      publishedYear: { bsonType: 'number', minimum: 0, maximum: 2100 },
      pages: { bsonType: 'number', minimum: 1 },
      description: { bsonType: 'string' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  }
};

export const migration003CreateBooks: Migration = {
  version: 3,
  name: '003_create_books',
  up: async (db) => {
    await db.ensureCollection('books', booksValidator);
    await db.ensureIndex('books', { author: 1 }, { name: 'books_author' });
  }
};
