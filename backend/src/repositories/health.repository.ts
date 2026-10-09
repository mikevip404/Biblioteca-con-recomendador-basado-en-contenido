import type { MongoDatabase } from '../db/mongo.js';

/**
 * Puerto (interfaz) del repositorio de salud.
 * El servicio depende de esta abstracción, no de la implementación concreta.
 */
export interface HealthRepository {
  checkDatabase(): Promise<{ ok: boolean; latencyMs: number }>;
}

/** Implementación concreta sobre MongoDB (comando `ping`). */
export class MongoHealthRepository implements HealthRepository {
  constructor(private readonly db: MongoDatabase) {}

  async checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    await this.db.ping();
    return { ok: true, latencyMs: Date.now() - start };
  }
}
