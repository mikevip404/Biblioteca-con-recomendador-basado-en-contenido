import { HttpError } from '../middlewares/error.middleware.js';
function toDTO(author) {
    const dto = {
        id: author.id,
        name: author.name,
        createdAt: author.createdAt.toISOString(),
        updatedAt: author.updatedAt.toISOString()
    };
    if (author.bio !== undefined)
        dto.bio = author.bio;
    if (author.birthYear !== undefined)
        dto.birthYear = author.birthYear;
    if (author.country !== undefined)
        dto.country = author.country;
    return dto;
}
/** Lógica de autores. No conoce Express ni el driver de Mongo. */
export class AuthorService {
    authors;
    books;
    constructor(authors, books) {
        this.authors = authors;
        this.books = books;
    }
    async list() {
        const authors = await this.authors.findAll();
        return authors.map(toDTO);
    }
    async getById(id) {
        const author = await this.authors.findById(id);
        if (author === null) {
            throw HttpError.notFound('Autor no encontrado');
        }
        return toDTO(author);
    }
    async create(input) {
        const existing = await this.authors.findByName(input.name);
        if (existing !== null) {
            throw HttpError.conflict('Ya existe un autor con ese nombre');
        }
        const author = await this.authors.create(input);
        return toDTO(author);
    }
    async update(id, input) {
        const current = await this.authors.findById(id);
        if (current === null) {
            throw HttpError.notFound('Autor no encontrado');
        }
        if (input.name !== undefined && input.name !== current.name) {
            const duplicate = await this.authors.findByName(input.name);
            if (duplicate !== null && duplicate.id !== id) {
                throw HttpError.conflict('Ya existe un autor con ese nombre');
            }
        }
        const updated = await this.authors.updateById(id, input);
        if (updated === null) {
            throw HttpError.notFound('Autor no encontrado');
        }
        return toDTO(updated);
    }
    async remove(id) {
        const current = await this.authors.findById(id);
        if (current === null) {
            throw HttpError.notFound('Autor no encontrado');
        }
        const linked = await this.books.countByAuthor(id);
        if (linked > 0) {
            throw HttpError.conflict('No se puede borrar un autor que tiene libros asociados');
        }
        await this.authors.deleteById(id);
    }
}
