import { describe, expect, it } from 'vitest';
import type { MongoDatabase } from '../../src/db/mongo.js';
import { MongoHealthRepository } from '../../src/repositories/health.repository.js';

/** Doble mínimo: solo importa si `ping` resuelve o rechaza. */
function makeDb(pingImpl: () => Promise<void>): MongoDatabase {
  return {
    ping: pingImpl,
    ensureCollection: async () => undefined,
    ensureIndex: async () => undefined,
    insertOne: async () => undefined,
    insertMany: async () => undefined,
    find: async () => [],
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
