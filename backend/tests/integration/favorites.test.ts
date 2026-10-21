import { ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectMongo, type MongoDatabase } from '../../src/db/mongo.js';
import { runMigrations } from '../../src/db/migrate.js';
import { JwtTokenService } from '../../src/services/token.service.js';
import type { UserRole } from '../../src/types/auth.js';
import { authHeader, type TestIdentity } from '../helpers/catalog-fixtures.js';
import { buildTestApp } from '../helpers/test-app.js';

const TEST_SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres!!';

let mongod: MongoMemoryServer;
let db: MongoDatabase;
let app: ReturnType<typeof buildTestApp>;
let tokenService: JwtTokenService;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  db = await connectMongo(mongod.getUri(), 'biblioteca_favorites_test');
  await runMigrations(db);
  tokenService = new JwtTokenService({ secret: TEST_SECRET, accessTokenTtlSec: 900 });
  app = buildTestApp(db, tokenService);
}, 180_000);

afterAll(async () => {
  await db.close();
  await mongod.stop();
});

async function createUser(role: UserRole, fullName: string): Promise<TestIdentity> {
  const id = new ObjectId();
  await db.insertOne('users', {
    _id: id,
    email: `user-${id.toHexString()}@test.local`,
    passwordHash: 'hash-de-prueba',
    fullName,
    role,
    isActive: true,
    failedLoginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return { id: id.toString(), token: tokenService.signAccessToken({ sub: id.toString(), role }) };
}

async function setupBook(): Promise<string> {
  const admin = await createUser('admin', 'Admin Catalogo');
  const author = await request(app)
    .post('/api/authors')
    .set(authHeader(admin.token))
    .send({ name: `Autor ${new ObjectId().toHexString()}` });
  const genre = await request(app)
    .post('/api/genres')
    .set(authHeader(admin.token))
    .send({ name: `Genero ${new ObjectId().toHexString()}` });
  const book = await request(app)
    .post('/api/books')
    .set(authHeader(admin.token))
    .send({
      title: `Libro ${new ObjectId().toHexString()}`,
      author: author.body.data.id as string,
      genres: [genre.body.data.id as string]
    });
  return book.body.data.id as string;
}

describe('Favoritos (PUT/DELETE/GET)', () => {
  it('sin token responde 401', async () => {
    const bookId = await setupBook();
    expect((await request(app).put(`/api/books/${bookId}/favorite`)).status).toBe(401);
    expect((await request(app).get('/api/me/favorites')).status).toBe(401);
  });

  it('marca favorito de forma idempotente y lo refleja en el detalle', async () => {
    const bookId = await setupBook();
    const lector = await createUser('lector', 'Lector Favorito');

    const first = await request(app)
      .put(`/api/books/${bookId}/favorite`)
      .set(authHeader(lector.token));
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ bookId, isFavorite: true });

    // Marcar de nuevo no duplica.
    await request(app)
      .put(`/api/books/${bookId}/favorite`)
      .set(authHeader(lector.token));

    const mine = await request(app)
      .get('/api/me/favorites')
      .set(authHeader(lector.token));
    expect(mine.status).toBe(200);
    expect(mine.body.total).toBe(1);
    expect(mine.body.data[0].book.id).toBe(bookId);
    expect(typeof mine.body.data[0].book.title).toBe('string');
    expect(mine.body.data[0].book.averageRating).toBe(0);

    const detail = await request(app)
      .get(`/api/books/${bookId}`)
      .set(authHeader(lector.token));
    expect(detail.body.data.isFavorite).toBe(true);
  });

  it('quita el favorito de forma idempotente', async () => {
    const bookId = await setupBook();
    const lector = await createUser('lector', 'Lector Quita');

    await request(app)
      .put(`/api/books/${bookId}/favorite`)
      .set(authHeader(lector.token));

    const first = await request(app)
      .delete(`/api/books/${bookId}/favorite`)
      .set(authHeader(lector.token));
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ bookId, isFavorite: false });

    // Quitar de nuevo no falla.
    expect(
      (
        await request(app)
          .delete(`/api/books/${bookId}/favorite`)
          .set(authHeader(lector.token))
      ).status
    ).toBe(200);

    const mine = await request(app)
      .get('/api/me/favorites')
      .set(authHeader(lector.token));
    expect(mine.body.total).toBe(0);

    const detail = await request(app)
      .get(`/api/books/${bookId}`)
      .set(authHeader(lector.token));
    expect(detail.body.data.isFavorite).toBe(false);
  });

  it('responde 404 al marcar un libro inexistente', async () => {
    const lector = await createUser('lector', 'Lector Fantasma');
    const res = await request(app)
      .put(`/api/books/${new ObjectId().toString()}/favorite`)
      .set(authHeader(lector.token));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
