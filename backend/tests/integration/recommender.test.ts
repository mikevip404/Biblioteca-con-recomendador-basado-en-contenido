import { ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectMongo, type MongoDatabase } from '../../src/db/mongo.js';
import { runMigrations } from '../../src/db/migrate.js';
import { JwtTokenService } from '../../src/services/token.service.js';
import { slugify } from '../../src/utils/slug.js';
import { authHeader, makeIdentity } from '../helpers/catalog-fixtures.js';
import { buildTestApp } from '../helpers/test-app.js';

const TEST_SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres!!';

let mongod: MongoMemoryServer;
let db: MongoDatabase;
let app: ReturnType<typeof buildTestApp>;
let tokenService: JwtTokenService;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  db = await connectMongo(mongod.getUri(), 'biblioteca_recommender_test');
  await runMigrations(db);
  tokenService = new JwtTokenService({ secret: TEST_SECRET, accessTokenTtlSec: 900 });
  app = buildTestApp(db, tokenService);
}, 180_000);

afterAll(async () => {
  await db.close();
  await mongod.stop();
});

const now = (): Date => new Date();

async function insertGenre(name: string): Promise<string> {
  return db.insertOne('genres', {
    name,
    slug: slugify(name),
    createdAt: now(),
    updatedAt: now()
  });
}

async function insertAuthor(name: string): Promise<string> {
  return db.insertOne('authors', { name, createdAt: now(), updatedAt: now() });
}

interface BookSeed {
  title: string;
  authorId: string;
  genreIds: string[];
  tags: string[];
  language: string;
  publishedYear: number;
  pages: number;
  ratingCount?: number;
  ratingSum?: number;
}

async function insertBook(seed: BookSeed): Promise<string> {
  return db.insertOne('books', {
    title: seed.title,
    author: new ObjectId(seed.authorId),
    genres: seed.genreIds.map((id) => new ObjectId(id)),
    tags: seed.tags,
    language: seed.language,
    publishedYear: seed.publishedYear,
    pages: seed.pages,
    createdBy: new ObjectId(),
    vectorStale: true,
    ratingCount: seed.ratingCount ?? 0,
    ratingSum: seed.ratingSum ?? 0,
    createdAt: now(),
    updatedAt: now()
  });
}

async function rate(
  userId: string,
  bookId: string,
  value: number
): Promise<void> {
  await db.insertOne('ratings', {
    userId: new ObjectId(userId),
    bookId: new ObjectId(bookId),
    value,
    createdAt: now(),
    updatedAt: now()
  });
}

interface Catalog {
  sciFi: string;
  romance: string;
  authorA: string;
  authorB: string;
  authorC: string;
  similar: string;
  different: string;
}

async function seedCatalog(): Promise<Catalog> {
  const sciFi = await insertGenre(`Ciencia ficción ${new ObjectId().toHexString()}`);
  const romance = await insertGenre(`Romance ${new ObjectId().toHexString()}`);
  const authorA = await insertAuthor(`Autora A ${new ObjectId().toHexString()}`);
  const authorB = await insertAuthor(`Autor B ${new ObjectId().toHexString()}`);
  const authorC = await insertAuthor(`Autora C ${new ObjectId().toHexString()}`);
  const similar = await insertBook({
    title: 'Viaje a las estrellas',
    authorId: authorB,
    genreIds: [sciFi],
    tags: ['espacio', 'futuro'],
    language: 'es',
    publishedYear: 1995,
    pages: 320
  });
  const different = await insertBook({
    title: 'Amor en París',
    authorId: authorC,
    genreIds: [romance],
    tags: ['amor', 'viaje'],
    language: 'fr',
    publishedYear: 2015,
    pages: 480
  });
  return { sciFi, romance, authorA, authorB, authorC, similar, different };
}

describe('Recomendador por contenido', () => {
  it('exige autenticación en sus endpoints', async () => {
    const catalog = await seedCatalog();
    expect((await request(app).get('/api/me/recommendations')).status).toBe(401);
    expect(
      (await request(app).get(`/api/books/${catalog.similar}/similar`)).status
    ).toBe(401);
    expect((await request(app).get(`/api/books/${catalog.similar}/graph`)).status).toBe(
      401
    );
  });

  it('recomienda libros afines a partir de las valoraciones del usuario', async () => {
    const catalog = await seedCatalog();
    const liked = await insertBook({
      title: 'La última frontera',
      authorId: catalog.authorA,
      genreIds: [catalog.sciFi],
      tags: ['espacio', 'futuro'],
      language: 'es',
      publishedYear: 1990,
      pages: 300
    });
    const lector = makeIdentity(tokenService, 'lector');
    await rate(lector.id, liked, 5);

    const res = await request(app)
      .get('/api/me/recommendations?limit=5')
      .set(authHeader(lector.token));

    expect(res.status).toBe(200);
    expect(res.body.strategy).toBe('content-based');
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].book.id).toBe(catalog.similar);
    expect(res.body.data[0].reasons.length).toBeGreaterThan(0);
    const recommendedIds = res.body.data.map(
      (item: { book: { id: string } }) => item.book.id
    );
    expect(recommendedIds).not.toContain(liked);
  });

  it('usa la popularidad como respaldo cuando no hay historial', async () => {
    await seedCatalog();
    const best = await insertBook({
      title: 'El mejor valorado',
      authorId: (await insertAuthor(`Popular ${new ObjectId().toHexString()}`)),
      genreIds: [await insertGenre(`Popular ${new ObjectId().toHexString()}`)],
      tags: ['exito'],
      language: 'es',
      publishedYear: 2000,
      pages: 250,
      ratingCount: 10,
      ratingSum: 50
    });
    const lector = makeIdentity(tokenService, 'lector');

    const res = await request(app)
      .get('/api/me/recommendations?limit=5')
      .set(authHeader(lector.token));

    expect(res.status).toBe(200);
    expect(res.body.strategy).toBe('popular');
    expect(res.body.data[0].book.id).toBe(best);
    const averages = res.body.data.map(
      (item: { book: { averageRating: number } }) => item.book.averageRating
    );
    expect(averages).toEqual([...averages].sort((a: number, b: number) => b - a));
  });

  it('devuelve libros afines y el grafo del libro', async () => {
    const catalog = await seedCatalog();
    const lector = makeIdentity(tokenService, 'lector');

    const similar = await request(app)
      .get(`/api/books/${catalog.similar}/similar?limit=5`)
      .set(authHeader(lector.token));
    expect(similar.status).toBe(200);
    expect(similar.body.data[0].book.id).not.toBe(catalog.similar);
    expect(similar.body.data[0].score).toBeGreaterThan(0);
    expect(similar.body.data[0].reasons.length).toBeGreaterThan(0);

    const graph = await request(app)
      .get(`/api/books/${catalog.similar}/graph?limit=5`)
      .set(authHeader(lector.token));
    expect(graph.status).toBe(200);
    expect(graph.body.data.nodes[0].id).toBe(catalog.similar);
    expect(graph.body.data.edges.length).toBeGreaterThan(0);
    expect(graph.body.data.edges[0].source).toBe(catalog.similar);

    const invalid = await request(app)
      .get('/api/books/no-es-un-id/similar')
      .set(authHeader(lector.token));
    expect(invalid.status).toBe(400);

    const missing = await request(app)
      .get(`/api/books/${new ObjectId().toString()}/similar`)
      .set(authHeader(lector.token));
    expect(missing.status).toBe(404);
  });

  it('reconstruye los vectores y marca los libros como no obsoletos', async () => {
    await seedCatalog();
    const lector = makeIdentity(tokenService, 'lector');
    const admin = makeIdentity(tokenService, 'admin');

    const forbidden = await request(app)
      .post('/api/admin/recommender/rebuild')
      .set(authHeader(lector.token));
    expect(forbidden.status).toBe(403);

    const rebuild = await request(app)
      .post('/api/admin/recommender/rebuild')
      .set(authHeader(admin.token));
    expect(rebuild.status).toBe(200);
    expect(rebuild.body.data.state).toBe('completed');
    expect(rebuild.body.data.processed).toBe(rebuild.body.data.total);
    expect(rebuild.body.data.jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );

    const job = await request(app)
      .get(`/api/admin/recommender/rebuild/${rebuild.body.data.jobId}`)
      .set(authHeader(admin.token));
    expect(job.status).toBe(200);
    expect(job.body.data.state).toBe('completed');

    const books = await db.find('books');
    expect(books.every((book) => book['vectorStale'] === false)).toBe(true);
    expect((await db.countDocuments('book_vectors'))).toBe(books.length);

    const status = await request(app)
      .get('/api/admin/recommender/status')
      .set(authHeader(admin.token));
    expect(status.status).toBe(200);
    expect(status.body.data.state).toBe('completed');
  });
});
