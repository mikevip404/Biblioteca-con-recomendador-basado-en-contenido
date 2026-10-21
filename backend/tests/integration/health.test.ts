import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { HealthRepository } from '../../src/repositories/health.repository.js';
import { JwtTokenService } from '../../src/services/token.service.js';
import { FakeMongoDatabase } from '../helpers/fake-db.js';
import { buildTestApp } from '../helpers/test-app.js';

/** Repositorio falso: simula BD arriba. */
class FakeOkRepository implements HealthRepository {
  async checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
    return { ok: true, latencyMs: 3 };
  }
}

/** Repositorio falso: simula BD caída. */
class FakeDownRepository implements HealthRepository {
  async checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
    throw new Error('conexión rechazada');
  }
}

/** App completa con auth real sobre BD falsa (aquí solo importa /health). */
function buildApp(repository: HealthRepository) {
  const db = new FakeMongoDatabase();
  const tokenService = new JwtTokenService({
    secret: 'secreto-de-prueba-con-mas-de-32-caracteres!!',
    accessTokenTtlSec: 900
  });
  return buildTestApp(db, tokenService, { healthRepository: repository });
}

describe('GET /health', () => {
  it('responde 200 con estado ok cuando la BD responde', async () => {
    const res = await request(buildApp(new FakeOkRepository())).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.app).toBe('biblioteca-api');
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('ok');
    expect(typeof res.body.latencyMs).toBe('number');
    expect(typeof res.body.checkedAt).toBe('string');
    // La respuesta lleva el correlation-id para trazabilidad.
    expect(res.header['x-correlation-id']).toBeDefined();
  });

  it('responde 503 cuando la BD está caída', async () => {
    const res = await request(buildApp(new FakeDownRepository())).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.database).toBe('error');
    expect(res.header['x-correlation-id']).toBeDefined();
  });

  it('responde 404 estructurado en rutas desconocidas', async () => {
    const res = await request(buildApp(new FakeOkRepository())).get('/no-existe');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.correlationId).toBeDefined();
  });
});
