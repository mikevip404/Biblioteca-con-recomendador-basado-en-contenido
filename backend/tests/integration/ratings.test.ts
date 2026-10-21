import { ObjectId } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectMongo, type MongoDatabase } from '../../src/db/mongo.js';
import { runMigrations } from '../../src/db/migrate.js';
import { JwtTokenService } from '../../src/services/token.service.js';
import type { UserRole } from '../../src/types/auth.js';
import {
  authHeader,
  type TestIdentity
} from '../helpers/catalog-fixtures.js';
import { buildTestApp } from '../helpers/test-app.js';

const TEST_SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres!!';

let replset: MongoMemoryReplSet;
let db: MongoDatabase;
let app: ReturnType<typeof buildTestApp>;
let tokenService: JwtTokenService;

beforeAll(async () => {
  // Replica set de un nodo: necesaria para probar las transacciones reales.
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  db = await connectMongo(replset.getUri(), 'biblioteca_ratings_test', {
    transactions: true
  });
  await runMigrations(db);
  tokenService = new JwtTokenService({ secret: TEST_SECRET, accessTokenTtlSec: 900 });
  app = buildTestApp(db, tokenService);
}, 180_000);

afterAll(async () => {
  await db.close();
  await replset.stop();
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

async function putRating(
  identity: TestIdentity,
  bookId: string,
  body: Record<string, unknown>
) {
  return request(app)
    .put(`/api/books/${bookId}/rating`)
    .set(authHeader(identity.token))
    .send(body);
}

describe('Valoraciones (PUT/DELETE/GET)', () => {
  it('sin token responde 401', async () => {
    const bookId = await setupBook();
    expect((await request(app).put(`/api/books/${bookId}/rating`).send({ value: 5 })).status).toBe(401);
    expect((await request(app).get(`/api/books/${bookId}/ratings`)).status).toBe(401);
    expect((await request(app).get('/api/me/ratings')).status).toBe(401);
  });

  it('crea la valoración, actualiza contadores y aparece en el detalle', async () => {
    const bookId = await setupBook();
    const lector = await createUser('lector', 'Lector Uno');

    const put = await putRating(lector, bookId, { value: 5, comment: '  Excelente  ' });
    expect(put.status).toBe(200);
    expect(put.body.data.value).toBe(5);
    expect(put.body.data.comment).toBe('Excelente');
    expect(put.body.data.id).toBeTruthy();

    const detail = await request(app)
      .get(`/api/books/${bookId}`)
      .set(authHeader(lector.token));
    expect(detail.status).toBe(200);
    expect(detail.body.data.myRating).toBe(5);
    expect(detail.body.data.isFavorite).toBe(false);
    expect(detail.body.data.ratingCount).toBe(1);
    expect(detail.body.data.averageRating).toBe(5);

    const list = await request(app)
      .get(`/api/books/${bookId}/ratings`)
      .set(authHeader(lector.token));
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0].user).toEqual({ id: lector.id, name: 'Lector Uno' });
    expect(JSON.stringify(list.body)).not.toContain('@test.local');
  });

  it('actualizar cambia el valor y ajusta la suma (delta)', async () => {
    const bookId = await setupBook();
    const lector = await createUser('lector', 'Lector Dos');

    await putRating(lector, bookId, { value: 5 });
    const updated = await putRating(lector, bookId, { value: 2 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.value).toBe(2);

    const detail = await request(app)
      .get(`/api/books/${bookId}`)
      .set(authHeader(lector.token));
    expect(detail.body.data.ratingCount).toBe(1);
    expect(detail.body.data.averageRating).toBe(2);
    expect(detail.body.data.myRating).toBe(2);
  });

  it('escapar HTML del comentario (anti-XSS almacenado)', async () => {
    const bookId = await setupBook();
    const lector = await createUser('lector', 'Lector XSS');

    const put = await putRating(lector, bookId, {
      value: 4,
      comment: '<script>alert(1)</script>'
    });
    expect(put.status).toBe(200);
    expect(put.body.data.comment).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('rechaza valores fuera de rango, decimales y libros inexistentes', async () => {
    const bookId = await setupBook();
    const lector = await createUser('lector', 'Lector Validador');

    expect((await putRating(lector, bookId, { value: 0 })).status).toBe(400);
    expect((await putRating(lector, bookId, { value: 6 })).status).toBe(400);
    expect((await putRating(lector, bookId, { value: 3.5 })).status).toBe(400);
    expect((await putRating(lector, bookId, { value: 5, userId: lector.id })).status).toBe(400);

    const missing = await putRating(lector, new ObjectId().toString(), { value: 5 });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE de mi valoración restablece los contadores', async () => {
    const bookId = await setupBook();
    const lector = await createUser('lector', 'Lector Borra');

    await putRating(lector, bookId, { value: 5 });
    const del = await request(app)
      .delete(`/api/books/${bookId}/rating`)
      .set(authHeader(lector.token));
    expect(del.status).toBe(204);

    const detail = await request(app)
      .get(`/api/books/${bookId}`)
      .set(authHeader(lector.token));
    expect(detail.body.data.ratingCount).toBe(0);
    expect(detail.body.data.averageRating).toBe(0);
    expect(detail.body.data.myRating).toBeNull();

    // Idempotente: borrar de nuevo no falla.
    expect(
      (
        await request(app)
          .delete(`/api/books/${bookId}/rating`)
          .set(authHeader(lector.token))
      ).status
    ).toBe(204);
  });

  it('GET /me/ratings incluye los datos básicos del libro', async () => {
    const bookId = await setupBook();
    const lector = await createUser('lector', 'Lector Mio');
    await putRating(lector, bookId, { value: 3, comment: 'Normal' });

    const mine = await request(app)
      .get('/api/me/ratings')
      .set(authHeader(lector.token));
    expect(mine.status).toBe(200);
    expect(mine.body.total).toBe(1);
    expect(mine.body.data[0].value).toBe(3);
    expect(mine.body.data[0].book.id).toBe(bookId);
    expect(typeof mine.body.data[0].book.title).toBe('string');
    expect(mine.body.data[0].book.averageRating).toBe(3);
  });

  it('DELETE /ratings/:id lo puede hacer el dueño o un admin (403 para otro)', async () => {
    const bookId = await setupBook();
    const owner = await createUser('lector', 'Lector Dueno');
    const other = await createUser('lector', 'Lector Otro');
    const admin = await createUser('admin', 'Admin Borra');

    const created = await putRating(owner, bookId, { value: 5 });
    const ratingId = created.body.data.id as string;

    const forbidden = await request(app)
      .delete(`/api/ratings/${ratingId}`)
      .set(authHeader(other.token));
    expect(forbidden.status).toBe(403);

    expect(
      (
        await request(app)
          .delete(`/api/ratings/${ratingId}`)
          .set(authHeader(owner.token))
      ).status
    ).toBe(204);

    const second = await putRating(owner, bookId, { value: 4 });
    const adminDelete = await request(app)
      .delete(`/api/ratings/${second.body.data.id as string}`)
      .set(authHeader(admin.token));
    expect(adminDelete.status).toBe(204);
  });

  it('20 PUT concurrentes dejan una única valoración y contadores consistentes', async () => {
    const bookId = await setupBook();
    const lector = await createUser('lector', 'Lector Concurrencia');

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_unused, index) =>
        putRating(lector, bookId, { value: (index % 5) + 1 })
      )
    );
    for (const response of responses) {
      expect(response.status).toBe(200);
    }

    const list = await request(app)
      .get(`/api/books/${bookId}/ratings`)
      .set(authHeader(lector.token));
    expect(list.body.total).toBe(1);

    const detail = await request(app)
      .get(`/api/books/${bookId}`)
      .set(authHeader(lector.token));
    expect(detail.body.data.ratingCount).toBe(1);
    // La media del libro coincide con mi valoración (hay una sola).
    expect(detail.body.data.averageRating).toBe(detail.body.data.myRating);
  });
});
