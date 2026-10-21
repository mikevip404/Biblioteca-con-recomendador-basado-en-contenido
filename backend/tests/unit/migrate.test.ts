import { describe, expect, it } from 'vitest';
import {
  getAppliedVersions,
  runMigrations,
  validateMigrations,
  type Migration
} from '../../src/db/migrate.js';
import { migrations } from '../../src/db/migrations/index.js';
import { FakeMongoDatabase } from '../helpers/fake-db.js';

function makeMigration(version: number, fail = false): Migration {
  return {
    version,
    name: `00${version}_test`,
    up: async (db) => {
      if (fail) throw new Error('fallo simulado');
      await db.ensureCollection(`col_${version}`);
    }
  };
}

describe('validateMigrations', () => {
  it('acepta un registro ordenado con versiones únicas', () => {
    expect(() =>
      validateMigrations([makeMigration(1), makeMigration(2), makeMigration(10)])
    ).not.toThrow();
  });

  it('rechaza versiones duplicadas', () => {
    expect(() =>
      validateMigrations([makeMigration(1), makeMigration(1)])
    ).toThrow(/duplicada/);
  });

  it('rechaza registros desordenados', () => {
    expect(() =>
      validateMigrations([makeMigration(2), makeMigration(1)])
    ).toThrow(/ordenadas/);
  });

  it('rechaza versiones no positivas', () => {
    expect(() => validateMigrations([makeMigration(0)])).toThrow(/inválida/);
  });
});

describe('runMigrations', () => {
  it('aplica las pendientes en orden y las registra', async () => {
    const db = new FakeMongoDatabase();

    const applied = await runMigrations(db, [makeMigration(1), makeMigration(2)]);

    expect(applied).toBe(2);
    expect(db.createdCollections).toEqual(['migrations', 'col_1', 'col_2']);
    expect(await getAppliedVersions(db)).toEqual([1, 2]);
  });

  it('no reaplica migraciones ya registradas (idempotente)', async () => {
    const db = new FakeMongoDatabase();
    await db.ensureCollection('migrations');
    await db.insertOne('migrations', { version: 1, name: '001_test' });

    const applied = await runMigrations(db, [makeMigration(1), makeMigration(2)]);

    expect(applied).toBe(1);
    expect(db.createdCollections).not.toContain('col_1');
    expect(db.createdCollections).toContain('col_2');
    expect(await getAppliedVersions(db)).toEqual([1, 2]);
  });

  it('lanza con el nombre de la migración si su up falla', async () => {
    const db = new FakeMongoDatabase();

    await expect(
      runMigrations(db, [makeMigration(1), makeMigration(2, true)])
    ).rejects.toThrow(/002_test/);
    // La primera quedó registrada; la fallida, no.
    expect(await getAppliedVersions(db)).toEqual([1]);
  });
});

describe('migraciones reales del proyecto', () => {
  it('tienen versiones únicas, ascendentes y contiguas desde 1', () => {
    const versions = migrations.map((migration) => migration.version);
    expect(versions).toEqual(
      Array.from({ length: versions.length }, (_unused, index) => index + 1)
    );
    for (const migration of migrations) {
      expect(typeof migration.up).toBe('function');
    }
  });

  it('crean colecciones, índices y siembran 10 géneros de forma idempotente', async () => {
    const db = new FakeMongoDatabase();

    expect(await runMigrations(db)).toBe(migrations.length);

    for (const name of [
      'users',
      'genres',
      'books',
      'book_genres',
      'ratings',
      'favorites',
      'refresh_tokens',
      'migrations'
    ]) {
      expect(db.createdCollections).toContain(name);
    }
    // Índices únicos que preservan las reglas del modelo relacional.
    const uniqueNames = db.indexes
      .filter((index) => index.options?.unique === true)
      .map((index) => index.options?.name);
    expect(uniqueNames).toContain('users_email_unique');
    expect(uniqueNames).toContain('ratings_user_book_unique');
    expect(uniqueNames).toContain('favorites_user_book_unique');
    // Índice TTL de limpieza de sesiones (migración 008).
    const ttl = db.indexes.find(
      (index) => index.options?.name === 'refresh_tokens_expires_ttl'
    );
    expect(ttl?.options?.expireAfterSeconds).toBe(0);

    expect(db.docs.get('genres')).toHaveLength(10);

    // Segunda ejecución: no aplica nada ni duplica la semilla.
    expect(await runMigrations(db)).toBe(0);
    expect(db.docs.get('genres')).toHaveLength(10);
  });
});
