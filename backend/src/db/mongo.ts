import { Db, Document, MongoClient } from 'mongodb';

/** Direcciones de índice soportadas (incluye índices de texto). */
export type IndexDirection = 1 | -1 | 'text' | 'hashed' | '2dsphere';

export interface FindOptions {
  sort?: Record<string, 1 | -1>;
  limit?: number;
  /** Documentos a omitir (paginación). */
  skip?: number;
  /** Proyección de campos (1/0). */
  projection?: Document;
}

export interface IndexOptions {
  unique?: boolean;
  name?: string;
  /** Segundos tras `expiresAt` para auto-borrar (índice TTL). */
  expireAfterSeconds?: number;
  /** Excluye documentos sin el campo (para índices únicos opcionales). */
  sparse?: boolean;
  /** Pesos de los campos en un índice `text`. */
  weights?: Record<string, number>;
}

/** Actualización de Mongo: operadores usados por el código. */
export interface UpdateSpec {
  $set?: Document;
  $inc?: Document;
  $unset?: Document;
}

export interface UpdateOptions {
  /** Inserta el documento si el filtro no coincide (`PUT` idempotente). */
  upsert?: boolean;
}

/**
 * Abstracción del acceso a la base de datos (MongoDB).
 *
 * Los repositorios y las migraciones dependen de esta interfaz y NO del
 * driver `mongodb` directamente (principio de inversión de dependencias):
 * así los tests pueden inyectar un doble en memoria sin levantar MongoDB.
 */
export interface MongoDatabase {
  /** Verifica que la BD responde (se usa en el health check). */
  ping(): Promise<void>;
  /**
   * Crea la colección si no existe; si ya existe y se pasa un validador,
   * lo actualiza con `collMod`. Idempotente.
   */
  ensureCollection(name: string, validator?: Document): Promise<void>;
  /** Crea el índice si no existe. Idempotente. */
  ensureIndex(
    collection: string,
    keys: Record<string, IndexDirection>,
    options?: IndexOptions
  ): Promise<void>;
  /** Inserta un documento y devuelve el id (`_id`) generado o provisto. */
  insertOne(collection: string, doc: Document): Promise<string>;
  insertMany(collection: string, docs: Document[]): Promise<void>;
  find(collection: string, filter?: Document, options?: FindOptions): Promise<Document[]>;
  /** Devuelve el primer documento que coincide o `null`. */
  findOne(collection: string, filter: Document, options?: FindOptions): Promise<Document | null>;
  /** Cuenta los documentos que coinciden con el filtro. */
  countDocuments(collection: string, filter?: Document): Promise<number>;
  /** Aplica `$set`. Devuelve cuántos documentos se modificaron. */
  updateOne(collection: string, filter: Document, update: { $set: Document }): Promise<number>;
  /** Aplica `$set` a todos los coincidentes. Devuelve cuántos se modificaron. */
  updateMany(collection: string, filter: Document, update: { $set: Document }): Promise<number>;
  /** Borra el primer documento que coincide. Devuelve cuántos se borraron. */
  deleteOne(collection: string, filter: Document): Promise<number>;
  /** Borra todos los coincidentes. Devuelve cuántos se borraron. */
  deleteMany(collection: string, filter: Document): Promise<number>;
  /**
   * Ejecuta `work` dentro de una transacción. Si las transacciones están
   * desactivadas (Mongo local sin replica set) ejecuta `work` directamente.
   */
  withTransaction<T>(work: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface ConnectOptions {
  /** Exige replica set. En producción siempre `true`. */
  transactions?: boolean;
}

/**
 * Puerto de unidad de trabajo que consumen los servicios. Permite abrir una
 * transacción sin depender del driver ni de `MongoDatabase` completo.
 */
export interface UnitOfWork {
  withTransaction<T>(work: () => Promise<T>): Promise<T>;
}

/** Sesión ambiente: las operaciones de la fachada la adjuntan si existe. */
const sessionStorage = new AsyncLocalStorage<ClientSession>();

/**
 * Conecta a MongoDB (Atlas con `mongodb+srv://` o local con `mongodb://`).
 * `serverSelectionTimeoutMS` corto para que el /health falle rápido (503)
 * en vez de colgar 30s si la BD está caída.
 */
export async function connectMongo(
  uri: string,
  dbName: string
): Promise<MongoDatabase> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  return wrapDb(client.db(dbName), () => client.close());
}

/**
 * Adaptador: convierte un `Db` del driver en nuestro `MongoDatabase`.
 * Es la única pieza que conoce los detalles del driver `mongodb`.
 */
export function wrapDb(
  db: Db,
  onClose: () => Promise<void>
): MongoDatabase {
  return {
    async ping(): Promise<void> {
      await db.command({ ping: 1 });
    },
    async ensureCollection(
      name: string,
      validator?: Document
    ): Promise<void> {
      const existing = await db.listCollections({ name }).toArray();
      if (existing.length === 0) {
        await db.createCollection(
          name,
          validator === undefined ? undefined : { validator }
        );
      } else if (validator !== undefined) {
        await db.command({ collMod: name, validator });
      }
    },
    async ensureIndex(collection, keys, options): Promise<void> {
      await db.collection(collection).createIndex(keys, options);
    },
    async insertOne(collection, doc): Promise<string> {
      const result = await db.collection(collection).insertOne(doc);
      return String(result.insertedId);
    },
    async insertMany(collection, docs): Promise<void> {
      if (docs.length === 0) return;
      await db.collection(collection).insertMany(docs, { ordered: false });
    },
    find(collection, filter, options): Promise<Document[]> {
      let cursor = db.collection(collection).find(filter ?? {});
      if (options?.projection !== undefined) {
        cursor = cursor.project(options.projection);
      }
      if (options?.sort !== undefined) {
        cursor = cursor.sort(options.sort);
      }
      if (options?.skip !== undefined) {
        cursor = cursor.skip(options.skip);
      }
      if (options?.limit !== undefined) {
        cursor = cursor.limit(options.limit);
      }
      return cursor.toArray();
    },
    async findOne(collection, filter, options): Promise<Document | null> {
      return db.collection(collection).findOne(filter, {
        ...(options?.projection !== undefined ? { projection: options.projection } : {}),
        ...(options?.sort !== undefined ? { sort: options.sort } : {})
      });
    },
    async countDocuments(collection, filter): Promise<number> {
      return db.collection(collection).countDocuments(filter ?? {});
    },
    async updateOne(collection, filter, update): Promise<number> {
      const result = await db.collection(collection).updateOne(filter, update);
      return result.modifiedCount;
    },
    async updateMany(collection, filter, update): Promise<number> {
      const result = await db.collection(collection).updateMany(filter, update);
      return result.modifiedCount;
    },
    async deleteOne(collection, filter): Promise<number> {
      const result = await db.collection(collection).deleteOne(filter);
      return result.deletedCount;
    },
    async deleteMany(collection, filter): Promise<number> {
      const result = await db.collection(collection).deleteMany(filter);
      return result.deletedCount;
    },
    close(): Promise<void> {
      return onClose();
    }
  };
}
