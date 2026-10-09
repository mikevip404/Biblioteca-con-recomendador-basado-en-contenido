import { Db, Document, MongoClient } from 'mongodb';

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
    keys: Record<string, 1 | -1>,
    options?: { unique?: boolean; name?: string }
  ): Promise<void>;
  insertOne(collection: string, doc: Document): Promise<void>;
  insertMany(collection: string, docs: Document[]): Promise<void>;
  find(collection: string, filter?: Document): Promise<Document[]>;
  close(): Promise<void>;
}

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
    async insertOne(collection, doc): Promise<void> {
      await db.collection(collection).insertOne(doc);
    },
    async insertMany(collection, docs): Promise<void> {
      if (docs.length === 0) return;
      await db.collection(collection).insertMany(docs, { ordered: false });
    },
    find(collection, filter): Promise<Document[]> {
      return db
        .collection(collection)
        .find(filter ?? {})
        .toArray();
    },
    close(): Promise<void> {
      return onClose();
    }
  };
}
