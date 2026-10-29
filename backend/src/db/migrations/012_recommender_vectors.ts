import type { Document } from 'mongodb';
import type { Migration } from '../migrate.js';

/**
 * Vectores del recomendador (Fase 5).
 *
 * Cada documento guarda el vector disperso de un libro como una lista de
 * `{ token, weight }` (los nombres de campo de Mongo no admiten caracteres
 * como `.` en los tags, por eso no se usa un objeto token→peso).
 * El `_id` es el mismo ObjectId del libro: relación 1–1 y borrado en cascada
 * trivial. Los vectores se regeneran con el endpoint de reconstrucción.
 */
const bookVectorsValidator: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['features', 'updatedAt'],
    properties: {
      features: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['token', 'weight'],
          properties: {
            token: { bsonType: 'string' },
            weight: { bsonType: 'number', minimum: 0 }
          }
        }
      },
      dimensions: { bsonType: 'int', minimum: 0 },
      updatedAt: { bsonType: 'date' }
    }
  }
};

export const migration012RecommenderVectors: Migration = {
  version: 12,
  name: '012_recommender_vectors',
  up: async (db) => {
    await db.ensureCollection('book_vectors', bookVectorsValidator);
  }
};
