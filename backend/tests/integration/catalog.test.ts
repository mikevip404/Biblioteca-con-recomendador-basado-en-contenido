import { ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectMongo, type MongoDatabase } from '../../src/db/mongo.js';
import { runMigrations } from '../../src/db/migrate.js';
import { JwtTokenService } from '../../src/services/token.service.js';
import { authHeader, makeIdentity, type TestIdentity } from '../helpers/catalog-fixtures.js';
import { buildTestApp } from '../helpers/test-app.js';

const TEST_SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres!!';

let mongod: MongoMemoryServer;
let db: MongoDatabase;
let app: ReturnType<typeof buildTestApp>;
let tokenService: JwtTokenService;
let admin: TestIdentity;
let lector: TestIdentity;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  db = await connectMongo(mongod.getUri(), 'biblioteca_catalog_test');
  await runMigrations(db);
  tokenService = new JwtTokenService({ secret: TEST_SECRET, accessTokenTtlSec: 900 });
  app = buildTestApp(db, tokenService);
  admin = makeIdentity(tokenService, 'admin');
  lector = makeIdentity(tokenService, 'lector');
}, 180_000);

afterAll(async () => {
  await db.close();
  await mongod.stop();
});

async function createAuthor(name: string, token = admin.token) {
  return request(app).post('/api/authors').set(authHeader(token)).send({ name });
}

async function createGenre(name: string, token = admin.token) {
  return request(app).post('/api/genres').set(authHeader(token)).send({ name });
}

async function createBook(
  authorId: string,
  genreIds: string[],
  overrides: Record<string, unknown> = {},
  token = admin.token
) {
  return request(app)
    .post('/api/books')
    .set(authHeader(token))
    .send({ title: 'Libro', author: authorId, genres: genreIds, ...overrides });
}

async function setupAuthorAndGenre(): Promise<{ authorId: string; genreId: string }> {
  const authorRes = await createAuthor(`Autor ${new ObjectId().toString()}`);
  const genreRes = await createGenre(`Genero ${new ObjectId().toString()}`);
  return {
    authorId: authorRes.body.data.id as string,
    genreId: genreRes.body.data.id as string
  };
}

describe('Autenticación y autorización del catálogo', () => {
  it('sin token responde 401 en autores, géneros y libros', async () => {
    expect((await request(app).get('/api/authors')).status).toBe(401);
    expect((await request(app).get('/api/genres')).status).toBe(401);
    expect((await request(app).get('/api/books')).status).toBe(401);
  });

  it('un lector puede leer pero no crear, editar ni borrar (403)', async () => {
    const { authorId } = await setupAuthorAndGenre();

    expect(
      (await request(app).get('/api/authors').set(authHeader(lector.token))).status
    ).toBe(200);

    expect(
      (await createAuthor('No permitido', lector.token)).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/authors/${authorId}`)
          .set(authHeader(lector.token))
          .send({ name: 'Cambio' })
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/authors/${authorId}`)
          .set(authHeader(lector.token))
      ).status
    ).toBe(403);
    expect((await createGenre('No permitido', lector.token)).status).toBe(403);
  });

  it('un admin puede crear autor y género (201)', async () => {
    const authorRes = await createAuthor('Autor Admin');
    expect(authorRes.status).toBe(201);
    expect(authorRes.body.data.name).toBe('Autor Admin');

    const genreRes = await createGenre('Genero Admin');
    expect(genreRes.status).toBe(201);
    expect(genreRes.body.data.slug).toBe('genero-admin');
  });
});

describe('Validación de entrada', () => {
  it('rechaza campos faltantes con 400', async () => {
    const noName = await request(app)
      .post('/api/authors')
      .set(authHeader(admin.token))
      .send({});
    expect(noName.status).toBe(400);
    expect(noName.body.error.code).toBe('BAD_REQUEST');
  });

  it('rechaza ids inválidos en params con 400', async () => {
    const res = await request(app)
      .get('/api/authors/no-es-un-objectid')
      .set(authHeader(admin.token));
    expect(res.status).toBe(400);
  });

  it('rechaza campos desconocidos (strict) con 400', async () => {
    const res = await request(app)
      .post('/api/authors')
      .set(authHeader(admin.token))
      .send({ name: 'Con extra', role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('rechaza libros sin autor/géneros o con ObjectId inválido', async () => {
    const { authorId, genreId } = await setupAuthorAndGenre();

    const missing = await request(app)
      .post('/api/books')
      .set(authHeader(admin.token))
      .send({ title: 'Sin relaciones' });
    expect(missing.status).toBe(400);

    const invalid = await createBook(authorId, ['123'], { title: 'Id malo' });
    expect(invalid.status).toBe(400);

    const unknownField = await createBook(authorId, [genreId], {
      title: 'Campo extra',
      hola: true
    });
    expect(unknownField.status).toBe(400);
  });

  it('responde 409 si el ISBN ya existe', async () => {
    const { authorId, genreId } = await setupAuthorAndGenre();
    const isbn = `978${Date.now()}`.slice(0, 13);
    const first = await createBook(authorId, [genreId], { title: 'Uno', isbn });
    expect(first.status).toBe(201);
    const second = await createBook(authorId, [genreId], { title: 'Dos', isbn });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
  });

  it('rechaza referencias inexistentes con 400 y detalle', async () => {
    const { genreId } = await setupAuthorAndGenre();
    const missingAuthor = await createBook(new ObjectId().toString(), [genreId]);
    expect(missingAuthor.status).toBe(400);

    const { authorId } = await setupAuthorAndGenre();
    const missingGenre = await createBook(authorId, [new ObjectId().toString()]);
    expect(missingGenre.status).toBe(400);
  });
});

describe('CRUD de libros', () => {
  it('crea un libro, normaliza tags y expone DTO sin vectorStale', async () => {
    const { authorId, genreId } = await setupAuthorAndGenre();
    const res = await createBook(authorId, [genreId], {
      title: '  Libro bonito  ',
      tags: ['Uno', 'uno', 'DOS'],
      isbn: '9781234567890'
    });

    expect(res.status).toBe(201);
    const book = res.body.data;
    expect(book.title).toBe('Libro bonito');
    expect(book.tags).toEqual(['uno', 'dos']);
    expect(book.vectorStale).toBeUndefined();
    expect(book.createdBy).toBe(admin.id);
    expect(book.author.id).toBe(authorId);
    expect(book.genres[0].id).toBe(genreId);
  });

  it('devuelve el libro con autor y géneros poblados', async () => {
    const { authorId, genreId } = await setupAuthorAndGenre();
    const created = await createBook(authorId, [genreId], { title: 'Poblado' });
    const id = created.body.data.id as string;

    const res = await request(app)
      .get(`/api/books/${id}`)
      .set(authHeader(lector.token));

    expect(res.status).toBe(200);
    expect(res.body.data.author.name).toBeTruthy();
    expect(res.body.data.genres[0].name).toBeTruthy();
    expect(res.body.data.genres[0].slug).toBeTruthy();
  });

  it('marca vectorStale=true al editar tags, género, autor, año o páginas', async () => {
    const a = await setupAuthorAndGenre();
    const b = await setupAuthorAndGenre();
    const created = await createBook(a.authorId, [a.genreId], { title: 'Stale' });
    const id = created.body.data.id as string;
    const objectId = new ObjectId(id);

    async function resetStale(): Promise<void> {
      await db.updateOne('books', { _id: objectId }, { $set: { vectorStale: false } });
    }
    async function isStale(): Promise<boolean> {
      const doc = await db.findOne('books', { _id: objectId });
      return doc?.['vectorStale'] === true;
    }

    for (const patch of [
      { tags: ['nuevo'] },
      { genres: [b.genreId] },
      { author: b.authorId },
      { publishedYear: 1999 },
      { pages: 123 }
    ]) {
      await resetStale();
      const res = await request(app)
        .patch(`/api/books/${id}`)
        .set(authHeader(admin.token))
        .send(patch);
      expect(res.status).toBe(200);
      expect(await isStale()).toBe(true);
    }

    await resetStale();
    const titleOnly = await request(app)
      .patch(`/api/books/${id}`)
      .set(authHeader(admin.token))
      .send({ title: 'Solo título' });
    expect(titleOnly.status).toBe(200);
    expect(await isStale()).toBe(false);
  });

  it('borra el libro y sus ratings/favoritos en cascada', async () => {
    const { authorId, genreId } = await setupAuthorAndGenre();
    const created = await createBook(authorId, [genreId], { title: 'Cascada' });
    const id = created.body.data.id as string;
    const bookObjectId = new ObjectId(id);
    const userId = new ObjectId();

    await db.insertOne('ratings', {
      userId,
      bookId: bookObjectId,
      value: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await db.insertOne('favorites', {
      userId,
      bookId: bookObjectId,
      createdAt: new Date()
    });

    const res = await request(app)
      .delete(`/api/books/${id}`)
      .set(authHeader(admin.token));
    expect(res.status).toBe(204);

    expect(await db.countDocuments('ratings', { bookId: bookObjectId })).toBe(0);
    expect(await db.countDocuments('favorites', { bookId: bookObjectId })).toBe(0);
  });
});

describe('Borrado bloqueado por libros asociados', () => {
  it('responde 409 al borrar autor o género con libros', async () => {
    const { authorId, genreId } = await setupAuthorAndGenre();
    await createBook(authorId, [genreId], { title: 'Asociado' });

    const authorDelete = await request(app)
      .delete(`/api/authors/${authorId}`)
      .set(authHeader(admin.token));
    expect(authorDelete.status).toBe(409);
    expect(authorDelete.body.error.message).toMatch(/libros/i);

    const genreDelete = await request(app)
      .delete(`/api/genres/${genreId}`)
      .set(authHeader(admin.token));
    expect(genreDelete.status).toBe(409);
  });
});

describe('Listado, filtros y paginación', () => {
  let authorId: string;
  let genreA: string;
  let genreB: string;

  beforeAll(async () => {
    const authorRes = await createAuthor(`Listado ${new ObjectId().toString()}`);
    authorId = authorRes.body.data.id as string;
    genreA = (await createGenre(`GeneroA ${new ObjectId().toString()}`)).body.data.id as string;
    genreB = (await createGenre(`GeneroB ${new ObjectId().toString()}`)).body.data.id as string;

    await createBook(authorId, [genreA], {
      title: 'Alpha',
      publishedYear: 2000,
      language: 'es',
      description: 'manual de python'
    });
    await createBook(authorId, [genreB], {
      title: 'Beta',
      publishedYear: 2010,
      language: 'en',
      description: 'novela histórica'
    });
    await createBook(authorId, [genreA], {
      title: 'Gamma',
      publishedYear: 2020,
      language: 'es',
      description: 'ensayo'
    });
  });

  it('pagina con metadatos (total, page, limit, totalPages)', async () => {
    const res = await request(app)
      .get(`/api/books?author=${authorId}&limit=2&page=1`)
      .set(authHeader(lector.token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
    expect(res.body.totalPages).toBe(2);
    expect(res.body.data).toHaveLength(2);
  });

  it('rechaza limit mayor que 50', async () => {
    const res = await request(app)
      .get('/api/books?limit=51')
      .set(authHeader(lector.token));
    expect(res.status).toBe(400);
  });

  it('ordena por publishedYear ascendente', async () => {
    const res = await request(app)
      .get(`/api/books?author=${authorId}&sort=publishedYear&order=asc`)
      .set(authHeader(lector.token));

    const years = res.body.data.map((book: { publishedYear: number }) => book.publishedYear);
    expect(years).toEqual([2000, 2010, 2020]);
  });

  it('filtra por género, año y lenguaje', async () => {
    const byGenre = await request(app)
      .get(`/api/books?author=${authorId}&genre=${genreA}`)
      .set(authHeader(lector.token));
    expect(byGenre.body.total).toBe(2);

    const byYear = await request(app)
      .get(`/api/books?author=${authorId}&yearFrom=2005&yearTo=2015`)
      .set(authHeader(lector.token));
    expect(byYear.body.total).toBe(1);
    expect(byYear.body.data[0].title).toBe('Beta');

    const byLanguage = await request(app)
      .get(`/api/books?author=${authorId}&language=en`)
      .set(authHeader(lector.token));
    expect(byLanguage.body.total).toBe(1);
  });

  it('busca por texto con q', async () => {
    const res = await request(app)
      .get(`/api/books?author=${authorId}&q=python`)
      .set(authHeader(lector.token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].title).toBe('Alpha');
  });

  it('rechaza filtros de query desconocidos', async () => {
    const res = await request(app)
      .get('/api/books?desconocido=1')
      .set(authHeader(lector.token));
    expect(res.status).toBe(400);
  });
});
