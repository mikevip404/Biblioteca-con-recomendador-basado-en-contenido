import { HttpError } from '../middlewares/error.middleware.js';
import { paginate } from '../repositories/query.builder.js';
/** Campos cuya modificación invalida el vector del recomendador (Fase 5). */
const VECTOR_STALE_FIELDS = [
    'genres',
    'tags',
    'author',
    'publishedYear',
    'pages'
];
function toDTO(book, authors, genres) {
    const dto = {
        id: book.id,
        title: book.title,
        author: authors.get(book.authorId) ?? { id: book.authorId, name: '' },
        genres: book.genreIds.map((id) => genres.get(id) ?? { id, name: '', slug: '' }),
        tags: book.tags,
        createdBy: book.createdBy,
        createdAt: book.createdAt.toISOString(),
        updatedAt: book.updatedAt.toISOString()
    };
    if (book.description !== undefined)
        dto.description = book.description;
    if (book.publishedYear !== undefined)
        dto.publishedYear = book.publishedYear;
    if (book.pages !== undefined)
        dto.pages = book.pages;
    if (book.language !== undefined)
        dto.language = book.language;
    if (book.isbn !== undefined)
        dto.isbn = book.isbn;
    if (book.coverUrl !== undefined)
        dto.coverUrl = book.coverUrl;
    return dto;
}
/** Lógica del catálogo de libros. No conoce Express ni el driver de Mongo. */
export class BookService {
    books;
    authors;
    genres;
    relations;
    constructor(books, authors, genres, relations) {
        this.books = books;
        this.authors = authors;
        this.genres = genres;
        this.relations = relations;
    }
    async list(command) {
        const { items, total, pagination } = await this.books.findMany({
            filter: {
                ...(command.q !== undefined ? { q: command.q } : {}),
                ...(command.genre !== undefined ? { genreId: command.genre } : {}),
                ...(command.author !== undefined ? { authorId: command.author } : {}),
                ...(command.yearFrom !== undefined ? { yearFrom: command.yearFrom } : {}),
                ...(command.yearTo !== undefined ? { yearTo: command.yearTo } : {}),
                ...(command.language !== undefined ? { language: command.language } : {})
            },
            sort: command.sort,
            order: command.order,
            page: command.page,
            limit: command.limit
        });
        const data = await this.toDTOs(items);
        return paginate(data, total, pagination);
    }
    async getById(id) {
        const book = await this.books.findById(id);
        if (book === null) {
            throw HttpError.notFound('Libro no encontrado');
        }
        const [dto] = await this.toDTOs([book]);
        if (dto === undefined) {
            throw HttpError.notFound('Libro no encontrado');
        }
        return dto;
    }
    async create(command, createdBy) {
        await this.assertAuthorExists(command.author);
        await this.assertGenresExist(command.genres);
        if (command.isbn !== undefined) {
            const duplicate = await this.books.findByIsbn(command.isbn);
            if (duplicate !== null) {
                throw HttpError.conflict('Ya existe un libro con ese ISBN');
            }
        }
        const data = {
            title: command.title,
            authorId: command.author,
            genreIds: command.genres,
            tags: command.tags ?? [],
            createdBy,
            ...(command.description !== undefined ? { description: command.description } : {}),
            ...(command.publishedYear !== undefined ? { publishedYear: command.publishedYear } : {}),
            ...(command.pages !== undefined ? { pages: command.pages } : {}),
            ...(command.language !== undefined ? { language: command.language } : {}),
            ...(command.isbn !== undefined ? { isbn: command.isbn } : {}),
            ...(command.coverUrl !== undefined ? { coverUrl: command.coverUrl } : {})
        };
        const book = await this.books.create(data);
        const [dto] = await this.toDTOs([book]);
        if (dto === undefined) {
            throw HttpError.internal('No se pudo componer el libro creado');
        }
        return dto;
    }
    async update(id, command) {
        const current = await this.books.findById(id);
        if (current === null) {
            throw HttpError.notFound('Libro no encontrado');
        }
        if (command.author !== undefined) {
            await this.assertAuthorExists(command.author);
        }
        if (command.genres !== undefined) {
            await this.assertGenresExist(command.genres);
        }
        if (command.isbn !== undefined && command.isbn !== current.isbn) {
            const duplicate = await this.books.findByIsbn(command.isbn);
            if (duplicate !== null && duplicate.id !== id) {
                throw HttpError.conflict('Ya existe un libro con ese ISBN');
            }
        }
        const patch = {};
        if (command.title !== undefined)
            patch.title = command.title;
        if (command.description !== undefined)
            patch.description = command.description;
        if (command.author !== undefined)
            patch.authorId = command.author;
        if (command.genres !== undefined)
            patch.genreIds = command.genres;
        if (command.tags !== undefined)
            patch.tags = command.tags;
        if (command.publishedYear !== undefined)
            patch.publishedYear = command.publishedYear;
        if (command.pages !== undefined)
            patch.pages = command.pages;
        if (command.language !== undefined)
            patch.language = command.language;
        if (command.isbn !== undefined)
            patch.isbn = command.isbn;
        if (command.coverUrl !== undefined)
            patch.coverUrl = command.coverUrl;
        // Cualquier cambio en género, tags, autor, año o páginas invalida el vector.
        if (VECTOR_STALE_FIELDS.some((field) => command[field] !== undefined)) {
            patch.vectorStale = true;
        }
        const updated = await this.books.updateById(id, patch);
        if (updated === null) {
            throw HttpError.notFound('Libro no encontrado');
        }
        const [dto] = await this.toDTOs([updated]);
        if (dto === undefined) {
            throw HttpError.internal('No se pudo componer el libro actualizado');
        }
        return dto;
    }
    async remove(id) {
        const current = await this.books.findById(id);
        if (current === null) {
            throw HttpError.notFound('Libro no encontrado');
        }
        // Cascada de datos dependientes. Sin replica set no hay transacción
        // disponible; queda encapsulado aquí y cualquier fallo se propaga.
        await this.relations.deleteForBook(id);
        const deleted = await this.books.deleteById(id);
        if (!deleted) {
            throw HttpError.notFound('Libro no encontrado');
        }
    }
    async assertAuthorExists(authorId) {
        const author = await this.authors.findById(authorId);
        if (author === null) {
            throw HttpError.badRequest('El autor indicado no existe', { author: authorId });
        }
    }
    async assertGenresExist(genreIds) {
        const found = await this.genres.findByIds(genreIds);
        const foundIds = new Set(found.map((genre) => genre.id));
        const missing = genreIds.filter((id) => !foundIds.has(id));
        if (missing.length > 0) {
            throw HttpError.badRequest('Uno o más géneros no existen', {
                genres: missing
            });
        }
    }
    async toDTOs(books) {
        const authorIds = [...new Set(books.map((book) => book.authorId).filter((id) => id !== ''))];
        const genreIds = [...new Set(books.flatMap((book) => book.genreIds))];
        const [authors, genres] = await Promise.all([
            this.authors.findByIds(authorIds),
            this.genres.findByIds(genreIds)
        ]);
        const authorMap = new Map(authors.map((author) => [author.id, { id: author.id, name: author.name }]));
        const genreMap = new Map(genres.map((genre) => [
            genre.id,
            { id: genre.id, name: genre.name, slug: genre.slug }
        ]));
        return books.map((book) => toDTO(book, authorMap, genreMap));
    }
}
