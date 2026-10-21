import { ObjectId, type Document } from 'mongodb';
import type {
  FindOptions,
  IndexDirection,
  IndexOptions,
  MongoDatabase,
  UpdateOptions,
  UpdateSpec
} from '../../src/db/mongo.js';

function valuesEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  // En Mongo, { campo: null } coincide con null o campo ausente.
  if (expected === null) return actual === null || actual === undefined;
  if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();
  }
  // ObjectIds distintos con el mismo hexadecimal.
  if (
    typeof actual === 'object' &&
    typeof expected === 'object' &&
    actual !== null &&
    expected !== null
  ) {
    return String(actual) === String(expected);
  }
  return false;
}

function isOperatorObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || value instanceof Date) {
    return false;
  }
  return Object.keys(value).some((key) => key.startsWith('$'));
}

function compareForOrder(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const left = String(a);
  const right = String(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Solo los operadores que usa el código ($gt/$gte/$lt/$lte/$ne). */
function matchesCondition(actual: unknown, condition: unknown): boolean {
  if (!isOperatorObject(condition)) {
    return valuesEqual(actual, condition);
  }
  for (const [op, operand] of Object.entries(condition)) {
    switch (op) {
      case '$gt':
        if (!(compareForOrder(actual, operand) > 0)) return false;
        break;
      case '$gte':
        if (!(compareForOrder(actual, operand) >= 0)) return false;
        break;
      case '$lt':
        if (!(compareForOrder(actual, operand) < 0)) return false;
        break;
      case '$lte':
        if (!(compareForOrder(actual, operand) <= 0)) return false;
        break;
      case '$ne':
        if (valuesEqual(actual, operand)) return false;
        break;
      case '$in': {
        if (!Array.isArray(operand)) return false;
        if (!operand.some((item) => valuesEqual(actual, item))) return false;
        break;
      }
      case '$nin': {
        if (!Array.isArray(operand)) return false;
        if (operand.some((item) => valuesEqual(actual, item))) return false;
        break;
      }
      default:
        return false;
    }
  }
  return true;
}

/** Búsqueda de texto mínima para `$text` (todos los términos, sin stemming). */
function matchesText(doc: Document, condition: unknown): boolean {
  if (
    typeof condition !== 'object' ||
    condition === null ||
    typeof (condition as { $search?: unknown }).$search !== 'string'
  ) {
    return false;
  }
  const terms = (condition as { $search: string }).$search
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
  const haystack = `${String(doc['title'] ?? '')} ${String(doc['description'] ?? '')}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function matchesFilter(doc: Document, filter: Document): boolean {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$text') return matchesText(doc, condition);
    return matchesCondition(doc[key], condition);
  });
}

/**
 * Proyección simple: inclusion (`{campo:1}`) o exclusión (`{campo:0}`).
 * `_id` se incluye siempre salvo que se excluya explícitamente.
 */
function applyProjection(doc: Document, projection: Document): Document {
  const entries = Object.entries(projection);
  if (entries.length === 0) return { ...doc };
  const including = entries.some(([, value]) => value === 1);
  if (including) {
    const result: Document = {};
    for (const [key, value] of entries) {
      if (value === 1 && doc[key] !== undefined) result[key] = doc[key];
    }
    if (projection['_id'] !== 0 && doc['_id'] !== undefined && result['_id'] === undefined) {
      result['_id'] = doc['_id'];
    }
    return result;
  }
  const result: Document = { ...doc };
  for (const [key, value] of entries) {
    if (value === 0) delete result[key];
  }
  return result;
}

/**
 * Como el driver real, el insert muta el documento añadiendo `_id` si falta.
 */
function withObjectId(doc: Document): void {
  if (doc['_id'] === undefined) {
    doc['_id'] = new ObjectId();
  }
}

/** Aplica `$set` y `$inc` como el driver real. */
function applyUpdate(doc: Document, update: UpdateSpec): void {
  if (update.$set !== undefined) {
    Object.assign(doc, update.$set);
  }
  if (update.$inc !== undefined) {
    for (const [key, delta] of Object.entries(update.$inc)) {
      const current = doc[key];
      doc[key] = (typeof current === 'number' ? current : 0) + Number(delta);
    }
  }
  if (update.$unset !== undefined) {
    for (const key of Object.keys(update.$unset)) {
      delete doc[key];
    }
  }
}

/**
 * Doble de test en memoria de MongoDatabase. Soporta igualdad, `null`,
 * comparadores de orden y `$set`; suficiente para los filtros que usan los
 * repositorios (no pretende ser un Mongo completo).
 */
export class FakeMongoDatabase implements MongoDatabase {
  public docs = new Map<string, Document[]>();
  public createdCollections: string[] = [];
  public indexes: Array<{
    collection: string;
    keys: Record<string, IndexDirection>;
    options?: IndexOptions;
  }> = [];

  async ping(): Promise<void> {
    // En memoria: siempre responde.
  }

  async ensureCollection(name: string): Promise<void> {
    if (!this.docs.has(name)) {
      this.docs.set(name, []);
      this.createdCollections.push(name);
    }
  }

  async ensureIndex(
    collection: string,
    keys: Record<string, IndexDirection>,
    options?: IndexOptions
  ): Promise<void> {
    this.indexes.push({ collection, keys, options });
  }

  async insertOne(collection: string, doc: Document): Promise<string> {
    withObjectId(doc);
    this.collectionDocs(collection).push(doc);
    return String(doc['_id']);
  }

  async insertMany(collection: string, docs: Document[]): Promise<void> {
    for (const doc of docs) withObjectId(doc);
    this.collectionDocs(collection).push(...docs);
  }

  /**
   * Como Mongo real, insertar en una colección inexistente la crea
   * implícitamente (sin pasar por `ensureCollection`/migraciones).
   */
  private collectionDocs(name: string): Document[] {
    let list = this.docs.get(name);
    if (list === undefined) {
      list = [];
      this.docs.set(name, list);
    }
    return list;
  }

  async find(
    collection: string,
    filter?: Document,
    options?: FindOptions
  ): Promise<Document[]> {
    let result = (this.docs.get(collection) ?? []).filter(
      (doc) => filter === undefined || matchesFilter(doc, filter)
    );
    const sort = options?.sort;
    if (sort !== undefined) {
      const criteria = Object.entries(sort);
      result = [...result].sort((a, b) => {
        for (const [key, direction] of criteria) {
          const compared = compareForOrder(a[key], b[key]);
          if (compared !== 0) return direction === 1 ? compared : -compared;
        }
        return 0;
      });
    }
    const start = options?.skip ?? 0;
    const end =
      options?.limit !== undefined ? start + options.limit : undefined;
    result = result.slice(start, end);
    if (options?.projection !== undefined) {
      result = result.map((doc) => applyProjection(doc, options.projection ?? {}));
    }
    return result;
  }

  async findOne(
    collection: string,
    filter: Document,
    options?: FindOptions
  ): Promise<Document | null> {
    const first = await this.find(collection, filter, { ...options, limit: 1 });
    return first[0] ?? null;
  }

  async countDocuments(collection: string, filter?: Document): Promise<number> {
    return (this.docs.get(collection) ?? []).filter(
      (doc) => filter === undefined || matchesFilter(doc, filter)
    ).length;
  }

  async updateOne(
    collection: string,
    filter: Document,
    update: UpdateSpec,
    options?: UpdateOptions
  ): Promise<number> {
    const list = this.collectionDocs(collection);
    const target = list.find((doc) => matchesFilter(doc, filter));
    if (target !== undefined) {
      applyUpdate(target, update);
      return 1;
    }
    if (options?.upsert === true) {
      const doc: Document = { ...filter };
      applyUpdate(doc, update);
      withObjectId(doc);
      list.push(doc);
    }
    return 0;
  }

  async updateMany(
    collection: string,
    filter: Document,
    update: UpdateSpec
  ): Promise<number> {
    let modified = 0;
    for (const doc of this.docs.get(collection) ?? []) {
      if (matchesFilter(doc, filter)) {
        applyUpdate(doc, update);
        modified++;
      }
    }
    return modified;
  }

  async deleteOne(collection: string, filter: Document): Promise<number> {
    const docs = this.docs.get(collection) ?? [];
    const index = docs.findIndex((doc) => matchesFilter(doc, filter));
    if (index === -1) return 0;
    docs.splice(index, 1);
    return 1;
  }

  async deleteMany(collection: string, filter: Document): Promise<number> {
    const docs = this.docs.get(collection) ?? [];
    const remaining = docs.filter((doc) => !matchesFilter(doc, filter));
    const removed = docs.length - remaining.length;
    this.docs.set(collection, remaining);
    return removed;
  }

  async aggregate(): Promise<Document[]> {
    // El doble en memoria no implementa pipelines: las pruebas de agregación
    // corren contra MongoDB real (mongodb-memory-server).
    throw new Error('aggregate no está soportado por FakeMongoDatabase');
  }

  async withTransaction<T>(work: () => Promise<T>): Promise<T> {
    // Sin replica set en memoria: una "transacción" es ejecución directa.
    return work();
  }

  async close(): Promise<void> {
    // Nada que cerrar en memoria.
  }
}
