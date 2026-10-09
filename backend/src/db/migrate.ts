import type { MongoDatabase } from './mongo.js';
import { migrations } from './migrations/index.js';

/**
 * Migración versionada de MongoDB.
 *
 * A diferencia del SQL, aquí `up` es código: crea colecciones con validador
 * `$jsonSchema`, índices y documentos semilla. Todo debe ser idempotente
 * (re-ejecutable sin error ni duplicados), porque MongoDB no permite DDL
 * dentro de transacciones: la idempotencia sustituye al BEGIN/COMMIT.
 */
export interface Migration {
  version: number;
  name: string;
  up: (db: MongoDatabase) => Promise<void>;
}

/** Valida el registro: versiones enteras positivas, únicas y ascendentes. */
export function validateMigrations(all: Migration[]): void {
  const versions = all.map((m) => m.version);
  for (const version of versions) {
    if (!Number.isInteger(version) || version <= 0) {
      throw new Error(`Versión de migración inválida: ${version}`);
    }
  }
  if (new Set(versions).size !== versions.length) {
    throw new Error('Existen migraciones con versión duplicada');
  }
  for (let i = 1; i < versions.length; i++) {
    const prev = versions[i - 1];
    const curr = versions[i];
    if (prev !== undefined && curr !== undefined && curr <= prev) {
      throw new Error(
        'Las migraciones deben estar ordenadas por versión ascendente'
      );
    }
  }
}

/** Versiones ya registradas en la colección `migrations`. */
export async function getAppliedVersions(
  db: MongoDatabase
): Promise<number[]> {
  const docs = await db.find('migrations');
  return docs
    .map((doc) => doc['version'])
    .filter((version): version is number => typeof version === 'number')
    .sort((a, b) => a - b);
}

/**
 * Aplica las migraciones pendientes en orden y registra cada una en la
 * colección `migrations`. Re-ejecutable: las ya aplicadas se omiten.
 * Devuelve la cantidad de migraciones aplicadas.
 */
export async function runMigrations(
  db: MongoDatabase,
  all: Migration[] = migrations
): Promise<number> {
  validateMigrations(all);
  await db.ensureCollection('migrations');

  const applied = new Set(await getAppliedVersions(db));
  const pending = all.filter((m) => !applied.has(m.version));

  for (const migration of pending) {
    try {
      await migration.up(db);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`La migración ${migration.name} falló: ${message}`);
    }
    await db.insertOne('migrations', {
      version: migration.version,
      name: migration.name,
      appliedAt: new Date()
    });
  }

  return pending.length;
}
