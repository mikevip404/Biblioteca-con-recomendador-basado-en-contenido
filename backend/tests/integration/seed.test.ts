import { ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectMongo, type MongoDatabase } from '../../src/db/mongo.js';
import { runMigrations } from '../../src/db/migrate.js';
import { seedCatalog } from '../../src/services/catalog-seeder.js';

let mongod: MongoMemoryServer;
let db: MongoDatabase;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  db = await connectMongo(mongod.getUri(), 'biblioteca_seed_test');
  await runMigrations(db);
}, 180_000);

afterAll(async () => {
  await db.close();
  await mongod.stop();
});

describe('seedCatalog', () => {
  it('siembra 8+ géneros, 30 autores, 150 libros, lectores y actividad', async () => {
    const createdBy = new ObjectId().toString();
    const result = await seedCatalog(db, createdBy);

    expect(result.totals.genres).toBeGreaterThanOrEqual(8);
    expect(result.totals.authors).toBe(30);
    expect(result.totals.books).toBe(150);
    expect(result.totals.readers).toBe(20);
    expect(result.totals.ratings).toBeGreaterThanOrEqual(200);
    expect(result.totals.favorites).toBeGreaterThanOrEqual(50);
  }, 120_000);

  it('es idempotente: la segunda ejecución no duplica nada', async () => {
    const createdBy = new ObjectId().toString();
    const before = await seedCatalog(db, createdBy);
    const after = await seedCatalog(db, createdBy);

    expect(after.genresCreated).toBe(0);
    expect(after.authorsCreated).toBe(0);
    expect(after.booksCreated).toBe(0);
    expect(after.readersCreated).toBe(0);
    expect(after.ratingsCreated).toBe(0);
    expect(after.favoritesCreated).toBe(0);
    expect(after.totals).toEqual(before.totals);
  }, 120_000);
});
