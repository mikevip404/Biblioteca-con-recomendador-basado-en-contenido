import { ObjectId } from 'mongodb';
function toObjectId(id) {
    if (!ObjectId.isValid(id))
        return null;
    try {
        return new ObjectId(id);
    }
    catch {
        return null;
    }
}
function toGenre(doc) {
    const id = doc['_id'];
    if (id === null || id === undefined)
        return null;
    const genre = {
        id: String(id),
        name: doc['name'],
        slug: doc['slug'],
        createdAt: doc['createdAt'],
        updatedAt: doc['updatedAt']
    };
    const description = doc['description'];
    if (description !== undefined)
        genre.description = description;
    return genre;
}
function toGenres(docs) {
    const genres = [];
    for (const doc of docs) {
        const genre = toGenre(doc);
        if (genre !== null)
            genres.push(genre);
    }
    return genres;
}
export class MongoGenreRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(id) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return null;
        const doc = await this.db.findOne('genres', { _id: objectId });
        return doc === null ? null : toGenre(doc);
    }
    async findByIds(ids) {
        const objectIds = ids
            .map(toObjectId)
            .filter((value) => value !== null);
        if (objectIds.length === 0)
            return [];
        const docs = await this.db.find('genres', { _id: { $in: objectIds } });
        return toGenres(docs);
    }
    async findByName(name) {
        const doc = await this.db.findOne('genres', { name });
        return doc === null ? null : toGenre(doc);
    }
    async findBySlug(slug) {
        const doc = await this.db.findOne('genres', { slug });
        return doc === null ? null : toGenre(doc);
    }
    async findAll() {
        const docs = await this.db.find('genres', {}, { sort: { name: 1 } });
        return toGenres(docs);
    }
    async create(data) {
        const now = new Date();
        await this.db.insertOne('genres', {
            name: data.name,
            slug: data.slug,
            ...(data.description !== undefined ? { description: data.description } : {}),
            createdAt: now,
            updatedAt: now
        });
        const genre = await this.findBySlug(data.slug);
        if (genre === null) {
            throw new Error('No se pudo leer el género recién creado');
        }
        return genre;
    }
    async updateById(id, patch) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return null;
        const set = { updatedAt: new Date() };
        if (patch.name !== undefined)
            set['name'] = patch.name;
        if (patch.slug !== undefined)
            set['slug'] = patch.slug;
        if (patch.description !== undefined)
            set['description'] = patch.description;
        await this.db.updateOne('genres', { _id: objectId }, { $set: set });
        return this.findById(id);
    }
    async deleteById(id) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return false;
        const deleted = await this.db.deleteOne('genres', { _id: objectId });
        return deleted > 0;
    }
}
