import type { Document } from 'mongodb';
import { describe, expect, it } from 'vitest';
import type { MongoDatabase } from '../../src/db/mongo.js';
import { MongoHealthRepository } from '../../src/repositories/health.repository.js';

/** Doble mínimo: solo importa si `ping` resuelve o rechaza. */
function makeDb(pingImpl: () => Promise<void>): MongoDatabase {
  const noopUpdate = async (): Promise<number> => 0;
  return {
    ping: pingImpl,
    ensureCollection: async () => undefined,
    ensureIndex: async () => undefined,
    insertOne: async () => '',
    insertMany: async () => undefined,
    find: async () => [] as Document[],
    findOne: async () => null,
    countDocuments: async () => 0,
    updateOne: noopUpdate,
    updateMany: noopUpdate,
    deleteOne: noopUpdate,
    deleteMany: noopUpdate,
    aggregate: async () => [] as Document[],
    withTransaction: async <T,>(work: () => Promise<T>) => work(),
    close: async () => undefined
  };
}

describe('MongoHealthRepository', () => {
  it('reporta ok con latencia cuando el ping responde', async () => {
    const repository = new MongoHealthRepository(makeDb(async () => undefined));

    const result = await repository.checkDatabase();

    expect(result.ok).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
  });

  it('propaga el error cuando el ping falla (el servicio lo convierte en 503)', async () => {
    const repository = new MongoHealthRepository(
      makeDb(async () => {
        throw new Error('sin conexión');
      })
    );

    await expect(repository.checkDatabase()).rejects.toThrow('sin conexión');
  });
});
