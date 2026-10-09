import type { Document } from 'mongodb';
import type { Migration } from '../migrate.js';

/**
 * Géneros (catálogo maestro para el one-hot del recomendador, Fase 4)
 * más la semilla inicial. Solo inserta los nombres faltantes: idempotente.
 */
const GENRE_SEED = [
  'Ciencia ficción',
  'Fantasía',
  'Novela negra',
  'Romance',
  'Historia',
  'Ciencia',
  'Filosofía',
  'Poesía',
  'Biografía',
  'Infantil'
];

const genresValidator: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name'],
    properties: {
      name: { bsonType: 'string' },
      createdAt: { bsonType: 'date' }
    }
  }
};

export const migration002CreateGenres: Migration = {
  version: 2,
  name: '002_create_genres',
  up: async (db) => {
    await db.ensureCollection('genres', genresValidator);
    await db.ensureIndex(
      'genres',
      { name: 1 },
      { unique: true, name: 'genres_name_unique' }
    );

    const existing = await db.find('genres');
    const existingNames = new Set(existing.map((genre) => genre['name']));
    const missing = GENRE_SEED.filter((name) => !existingNames.has(name)).map(
      (name) => ({ name, createdAt: new Date() })
    );
    await db.insertMany('genres', missing);
  }
};
