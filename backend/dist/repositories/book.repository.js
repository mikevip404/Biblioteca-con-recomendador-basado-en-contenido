import { ObjectId } from 'mongodb';
import { buildBookFilter, buildPagination, buildSort } from './query.builder.js';
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
function toStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((item) => String(item));
}
function toBook(doc) {
    const id = doc['_id'];
    const author = doc['author'];
    const createdBy = doc['createdBy'];
    if (id === null || id === undefined)
        return null;
    const book = {
        id: String(id),
        title: doc['title'],
        authorId: author === null || author === undefined ? '' : String(author),
        genreIds: toStringArray(doc['genres']),
        tags: toStringArray(doc['tags']),
        createdBy: createdBy === null || createdBy === undefined ? '' : String(createdBy),
        vectorStale: doc['vectorStale'] ?? true,
        createdAt: doc['createdAt'],
        updatedAt: doc['updatedAt']
    };
    const description = doc['description'];
    const publishedYear = doc['publishedYear'];
    const pages = doc['pages'];
    const language = doc['language'];
    const isbn = doc['isbn'];
    const coverUrl = doc['coverUrl'];
    if (description !== undefined)
        book.description = description;
    if (publishedYear !== undefined)
        book.publishedYear = publishedYear;
    if (pages !== undefined)
        book.pages = pages;
    if (language !== undefined)
        book.language = language;
    if (isbn !== undefined)
        book.isbn = isbn;
    if (coverUrl !== undefined)
        book.coverUrl = coverUrl;
    return book;
}
function toBooks(docs) {
    const books = [];
    for (const doc of docs) {
        const book = toBook(doc);
        if (book !== null)
            books.push(book);
    }
    return books;
}
export class MongoBookRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(id) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return null;
        const doc = await this.db.findOne('books', { _id: objectId });
        return doc === null ? null : toBook(doc);
    }
    async findByIsbn(isbn) {
        const doc = await this.db.findOne('books', { isbn });
        return doc === null ? null : toBook(doc);
    }
    async findMany(spec) {
        const filter = buildBookFilter(spec.filter);
        const pagination = buildPagination(spec.page, spec.limit);
        const sort = buildSort(spec.sort, spec.order);
        const [docs, total] = await Promise.all([
            this.db.find('books', filter, {
                sort,
                skip: pagination.skip,
                limit: pagination.limit
            }),
            this.db.countDocuments('books', filter)
        ]);
        return { items: toBooks(docs), total, pagination };
    }
    async create(data) {
        const author = toObjectId(data.authorId);
        const createdBy = toObjectId(data.createdBy);
        if (author === null || createdBy === null) {
            throw new Error('Referencias inválidas al crear el libro');
        }
        const genreIds = data.genreIds
            .map(toObjectId)
            .filter((value) => value !== null);
        const now = new Date();
        const id = await this.db.insertOne('books', {
            title: data.title,
            author,
            genres: genreIds,
            tags: data.tags,
            createdBy,
            vectorStale: true,
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.publishedYear !== undefined ? { publishedYear: data.publishedYear } : {}),
            ...(data.pages !== undefined ? { pages: data.pages } : {}),
            ...(data.language !== undefined ? { language: data.language } : {}),
            ...(data.isbn !== undefined ? { isbn: data.isbn } : {}),
            ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl } : {}),
            createdAt: now,
            updatedAt: now
        });
        const book = await this.findById(id);
        if (book === null) {
            throw new Error('No se pudo leer el libro recién creado');
        }
        return book;
    }
    async updateById(id, patch) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return null;
        const set = { updatedAt: new Date() };
        if (patch.title !== undefined)
            set['title'] = patch.title;
        if (patch.description !== undefined)
            set['description'] = patch.description;
        if (patch.tags !== undefined)
            set['tags'] = patch.tags;
        if (patch.publishedYear !== undefined)
            set['publishedYear'] = patch.publishedYear;
        if (patch.pages !== undefined)
            set['pages'] = patch.pages;
        if (patch.language !== undefined)
            set['language'] = patch.language;
        if (patch.isbn !== undefined)
            set['isbn'] = patch.isbn;
        if (patch.coverUrl !== undefined)
            set['coverUrl'] = patch.coverUrl;
        if (patch.vectorStale !== undefined)
            set['vectorStale'] = patch.vectorStale;
        if (patch.authorId !== undefined) {
            const author = toObjectId(patch.authorId);
            if (author !== null)
                set['author'] = author;
        }
        if (patch.genreIds !== undefined) {
            set['genres'] = patch.genreIds
                .map(toObjectId)
                .filter((value) => value !== null);
        }
        await this.db.updateOne('books', { _id: objectId }, { $set: set });
        return this.findById(id);
    }
    async deleteById(id) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return false;
        const deleted = await this.db.deleteOne('books', { _id: objectId });
        return deleted > 0;
    }
    async countByAuthor(authorId) {
        const objectId = toObjectId(authorId);
        if (objectId === null)
            return 0;
        return this.db.countDocuments('books', { author: objectId });
    }
    async countByGenre(genreId) {
        const objectId = toObjectId(genreId);
        if (objectId === null)
            return 0;
        return this.db.countDocuments('books', { genres: objectId });
    }
}
