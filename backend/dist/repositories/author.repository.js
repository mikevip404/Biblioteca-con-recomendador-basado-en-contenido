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
function toAuthor(doc) {
    const id = doc['_id'];
    if (id === null || id === undefined)
        return null;
    const author = {
        id: String(id),
        name: doc['name'],
        createdAt: doc['createdAt'],
        updatedAt: doc['updatedAt']
    };
    const bio = doc['bio'];
    const birthYear = doc['birthYear'];
    const country = doc['country'];
    if (bio !== undefined)
        author.bio = bio;
    if (birthYear !== undefined)
        author.birthYear = birthYear;
    if (country !== undefined)
        author.country = country;
    return author;
}
function toAuthors(docs) {
    const authors = [];
    for (const doc of docs) {
        const author = toAuthor(doc);
        if (author !== null)
            authors.push(author);
    }
    return authors;
}
export class MongoAuthorRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(id) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return null;
        const doc = await this.db.findOne('authors', { _id: objectId });
        return doc === null ? null : toAuthor(doc);
    }
    async findByIds(ids) {
        const objectIds = ids
            .map(toObjectId)
            .filter((value) => value !== null);
        if (objectIds.length === 0)
            return [];
        const docs = await this.db.find('authors', { _id: { $in: objectIds } });
        return toAuthors(docs);
    }
    async findByName(name) {
        const doc = await this.db.findOne('authors', { name });
        return doc === null ? null : toAuthor(doc);
    }
    async findAll() {
        const docs = await this.db.find('authors', {}, { sort: { name: 1 } });
        return toAuthors(docs);
    }
    async create(data) {
        const now = new Date();
        await this.db.insertOne('authors', {
            name: data.name,
            ...(data.bio !== undefined ? { bio: data.bio } : {}),
            ...(data.birthYear !== undefined ? { birthYear: data.birthYear } : {}),
            ...(data.country !== undefined ? { country: data.country } : {}),
            createdAt: now,
            updatedAt: now
        });
        const author = await this.findByName(data.name);
        if (author === null) {
            throw new Error('No se pudo leer el autor recién creado');
        }
        return author;
    }
    async updateById(id, patch) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return null;
        const set = { updatedAt: new Date() };
        if (patch.name !== undefined)
            set['name'] = patch.name;
        if (patch.bio !== undefined)
            set['bio'] = patch.bio;
        if (patch.birthYear !== undefined)
            set['birthYear'] = patch.birthYear;
        if (patch.country !== undefined)
            set['country'] = patch.country;
        await this.db.updateOne('authors', { _id: objectId }, { $set: set });
        return this.findById(id);
    }
    async deleteById(id) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return false;
        const deleted = await this.db.deleteOne('authors', { _id: objectId });
        return deleted > 0;
    }
}
