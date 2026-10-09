import type { Migration } from '../migrate.js';

/**
 * Índices del catálogo (Fase 3): búsqueda de texto sobre título/descripción,
 * compuestos para filtrar por género autor/año y unicidad de ISBN.
 */
export const migration010CatalogIndexes: Migration = {
  version: 10,
  name: '010_catalog_indexes',
  up: async (db) => {
    await db.ensureIndex(
      'books',
      { title: 'text', description: 'text' },
      { name: 'books_text', weights: { title: 5, description: 1 } }
    );
    await db.ensureIndex(
      'books',
      { genres: 1, publishedYear: -1 },
      { name: 'books_genres_publishedYear' }
    );
    await db.ensureIndex(
      'books',
      { author: 1, createdAt: -1 },
      { name: 'books_author_createdAt' }
    );
    await db.ensureIndex(
      'books',
      { genres: 1, author: 1 },
      { name: 'books_genres_author' }
    );
    await db.ensureIndex(
      'books',
      { isbn: 1 },
      { unique: true, sparse: true, name: 'books_isbn_unique' }
    );
  }
};
