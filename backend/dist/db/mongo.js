import { MongoClient } from 'mongodb';
/**
 * Conecta a MongoDB (Atlas con `mongodb+srv://` o local con `mongodb://`).
 * `serverSelectionTimeoutMS` corto para que el /health falle rápido (503)
 * en vez de colgar 30s si la BD está caída.
 */
export async function connectMongo(uri, dbName) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    return wrapDb(client.db(dbName), () => client.close());
}
/**
 * Adaptador: convierte un `Db` del driver en nuestro `MongoDatabase`.
 * Es la única pieza que conoce los detalles del driver `mongodb`.
 */
export function wrapDb(db, onClose) {
    return {
        async ping() {
            await db.command({ ping: 1 });
        },
        async ensureCollection(name, validator) {
            const existing = await db.listCollections({ name }).toArray();
            if (existing.length === 0) {
                await db.createCollection(name, validator === undefined ? undefined : { validator });
            }
            else if (validator !== undefined) {
                await db.command({ collMod: name, validator });
            }
        },
        async ensureIndex(collection, keys, options) {
            await db.collection(collection).createIndex(keys, options);
        },
        async insertOne(collection, doc) {
            const result = await db.collection(collection).insertOne(doc);
            return String(result.insertedId);
        },
        async insertMany(collection, docs) {
            if (docs.length === 0)
                return;
            await db.collection(collection).insertMany(docs, { ordered: false });
        },
        find(collection, filter, options) {
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
        async findOne(collection, filter, options) {
            return db.collection(collection).findOne(filter, {
                ...(options?.projection !== undefined ? { projection: options.projection } : {}),
                ...(options?.sort !== undefined ? { sort: options.sort } : {})
            });
        },
        async countDocuments(collection, filter) {
            return db.collection(collection).countDocuments(filter ?? {});
        },
        async updateOne(collection, filter, update) {
            const result = await db.collection(collection).updateOne(filter, update);
            return result.modifiedCount;
        },
        async updateMany(collection, filter, update) {
            const result = await db.collection(collection).updateMany(filter, update);
            return result.modifiedCount;
        },
        async deleteOne(collection, filter) {
            const result = await db.collection(collection).deleteOne(filter);
            return result.deletedCount;
        },
        async deleteMany(collection, filter) {
            const result = await db.collection(collection).deleteMany(filter);
            return result.deletedCount;
        },
        close() {
            return onClose();
        }
    };
}
