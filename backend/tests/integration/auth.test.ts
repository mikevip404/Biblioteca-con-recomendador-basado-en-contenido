import type { Express } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectMongo, type MongoDatabase } from '../../src/db/mongo.js';
import { runMigrations } from '../../src/db/migrate.js';
import { migrations } from '../../src/db/migrations/index.js';
import { JwtTokenService } from '../../src/services/token.service.js';
import { buildTestApp } from '../helpers/test-app.js';

const TEST_SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres!!';

let mongod: MongoMemoryServer;
let db: MongoDatabase;
let app: Express;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  db = await connectMongo(mongod.getUri(), 'biblioteca_test');
  // Migraciones reales: valida el registro completo en un motor de verdad.
  expect(await runMigrations(db)).toBe(migrations.length);

  const tokenService = new JwtTokenService({ secret: TEST_SECRET, accessTokenTtlSec: 900 });
  app = buildTestApp(db, tokenService);
}, 180_000);

afterAll(async () => {
  await db.close();
  await mongod.stop();
});

/** Extrae el valor del refresh token de la cabecera Set-Cookie. */
function extractRefreshToken(res: request.Response): string | undefined {
  const raw: unknown = res.headers['set-cookie'];
  const cookies: string[] = Array.isArray(raw)
    ? raw.filter((c): c is string => typeof c === 'string')
    : [];
  for (const cookie of cookies) {
    const match = /^refresh_token=([^;]*)/.exec(cookie);
    if (match?.[1] !== undefined && match[1] !== '') return match[1];
  }
  return undefined;
}

function setCookieHeader(res: request.Response): string[] {
  const raw: unknown = res.headers['set-cookie'];
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is string => typeof c === 'string');
}

async function register(
  email: string,
  password = 'Segura123',
  extra: Record<string, string> = {}
) {
  return request(app)
    .post('/api/auth/register')
    .send({ email, password, fullName: 'Usuario Prueba', ...extra });
}

describe('POST /api/auth/register', () => {
  it('registra con 201 y rol lector aunque se intente forzar admin', async () => {
    const res = await register('registro-ok@test.com', 'Segura123', { role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('registro-ok@test.com');
    expect(res.body.user.role).toBe('lector');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rechaza el email duplicado con 409', async () => {
    await register('duplicado@test.com');

    const res = await register('duplicado@test.com');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rechaza contraseñas débiles y emails inválidos con 400', async () => {
    for (const password of ['corta1A', 'sinmayuscula1', 'SINMINUSCULA1', 'SinNumero']) {
      const res = await register(`debil-${password}@test.com`, password);
      expect(res.status).toBe(400);
    }
    const badEmail = await register('no-es-email');
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('POST /api/auth/login', () => {
  it('devuelve access token en el cuerpo y refresh en cookie segura', async () => {
    await register('login-ok@test.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login-ok@test.com', password: 'Segura123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.email).toBe('login-ok@test.com');

    const cookies = setCookieHeader(res);
    const refresh = cookies.find((c) => c.startsWith('refresh_token='));
    expect(refresh).toBeDefined();
    expect(refresh).toContain('HttpOnly');
    expect(refresh).toContain('SameSite=Strict');
    expect(refresh).toContain('Path=/api/auth');
  });

  it('responde 401 genérico sin distinguir email de contraseña', async () => {
    await register('login-mal@test.com');

    const wrongPass = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login-mal@test.com', password: 'Mala0000' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@test.com', password: 'Mala0000' });

    expect(wrongPass.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPass.body.error.code).toBe('INVALID_CREDENTIALS');
    // Mensaje idéntico: no revela qué falló.
    expect(unknownEmail.body.error.message).toBe(wrongPass.body.error.message);
  });

  it('bloquea la cuenta tras 5 fallos (423) aunque luego acierte', async () => {
    await register('bloqueo-api@test.com');
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bloqueo-api@test.com', password: 'Mala0000' });
      expect(res.status).toBe(401);
    }
    const locked = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bloqueo-api@test.com', password: 'Segura123' });

    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe('LOCKED');
  });
});

describe('POST /api/auth/refresh', () => {
  it('rota: emite tokens nuevos e invalida el anterior', async () => {
    await register('rotacion@test.com');
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rotacion@test.com', password: 'Segura123' });
    const firstRefresh = extractRefreshToken(login);
    expect(firstRefresh).toBeDefined();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${firstRefresh ?? ''}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    const secondRefresh = extractRefreshToken(res);
    expect(secondRefresh).toBeDefined();
    expect(secondRefresh).not.toBe(firstRefresh);
  });

  it('detectar reutilización: el token viejo revoca la familia (401)', async () => {
    await register('reuso@test.com');
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reuso@test.com', password: 'Segura123' });
    const firstRefresh = extractRefreshToken(login) ?? '';

    const rotated = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${firstRefresh}`);
    expect(rotated.status).toBe(200);
    const secondRefresh = extractRefreshToken(rotated) ?? '';

    // El atacante reusa el token viejo → familia revocada.
    const reuse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${firstRefresh}`);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('SESSION_REUSED');

    // El token legítimo también murió con la familia.
    const aftermath = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${secondRefresh}`);
    expect(aftermath.status).toBe(401);
  });

  it('responde 401 sin cookie o con token desconocido', async () => {
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=invento');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('POST /api/auth/logout y logout-all', () => {
  it('logout revoca la sesión actual y limpia la cookie', async () => {
    await register('salir@test.com');
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'salir@test.com', password: 'Segura123' });
    const token = extractRefreshToken(login) ?? '';

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `refresh_token=${token}`);
    expect(res.status).toBe(204);
    expect(setCookieHeader(res).some((c) => c.startsWith('refresh_token=;'))).toBe(true);

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${token}`);
    expect(refresh.status).toBe(401);
  });

  it('logout-all revoca todas las sesiones (exige access token)', async () => {
    await register('salir-todas@test.com');
    const first = await request(app)
      .post('/api/auth/login')
      .send({ email: 'salir-todas@test.com', password: 'Segura123' });
    const second = await request(app)
      .post('/api/auth/login')
      .send({ email: 'salir-todas@test.com', password: 'Segura123' });

    // Sin token → 401.
    expect((await request(app).post('/api/auth/logout-all')).status).toBe(401);

    const res = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${first.body.accessToken as string}`);
    expect(res.status).toBe(204);

    for (const token of [extractRefreshToken(first) ?? '', extractRefreshToken(second) ?? '']) {
      const refresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${token}`);
      expect(refresh.status).toBe(401);
    }
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve el usuario autenticado sin el hash', async () => {
    await register('yo@test.com');
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'yo@test.com', password: 'Segura123' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('yo@test.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('niega sin token, con token inválido o expirado', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect(
      (
        await request(app).get('/api/auth/me').set('Authorization', 'Bearer roto')
      ).status
    ).toBe(401);

    const expiredService = new JwtTokenService({ secret: TEST_SECRET, accessTokenTtlSec: -60 });
    const expired = expiredService.signAccessToken({ sub: '507f1f77bcf86cd799439011', role: 'lector' });
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`)).status
    ).toBe(401);
  });
});
