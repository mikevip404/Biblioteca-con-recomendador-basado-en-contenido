import { HttpError } from '../middlewares/error.middleware.js';
import { slugify } from '../utils/slug.js';
function toDTO(genre) {
    const dto = {
        id: genre.id,
        name: genre.name,
        slug: genre.slug,
        createdAt: genre.createdAt.toISOString(),
        updatedAt: genre.updatedAt.toISOString()
    };
    if (genre.description !== undefined)
        dto.description = genre.description;
    return dto;
}
/** Lógica de géneros. El slug se deriva siempre del nombre. */
export class GenreService {
    genres;
    books;
    constructor(genres, books) {
        this.genres = genres;
        this.books = books;
    }
    async list() {
        const genres = await this.genres.findAll();
        return genres.map(toDTO);
    }
    async getById(id) {
        const genre = await this.genres.findById(id);
        if (genre === null) {
            throw HttpError.notFound('Género no encontrado');
        }
        return toDTO(genre);
    }
    async create(input) {
        const slug = slugify(input.name);
        if (slug === '') {
            throw HttpError.badRequest('El nombre del género no genera un slug válido');
        }
        const byName = await this.genres.findByName(input.name);
        if (byName !== null) {
            throw HttpError.conflict('Ya existe un género con ese nombre');
        }
        const bySlug = await this.genres.findBySlug(slug);
        if (bySlug !== null) {
            throw HttpError.conflict('Ya existe un género con ese slug');
        }
        const data = { name: input.name, slug };
        if (input.description !== undefined)
            data.description = input.description;
        const genre = await this.genres.create(data);
        return toDTO(genre);
    }
    async update(id, input) {
        const current = await this.genres.findById(id);
        if (current === null) {
            throw HttpError.notFound('Género no encontrado');
        }
        const patch = {};
        if (input.description !== undefined)
            patch.description = input.description;
        if (input.name !== undefined && input.name !== current.name) {
            const slug = slugify(input.name);
            if (slug === '') {
                throw HttpError.badRequest('El nombre del género no genera un slug válido');
            }
            const byName = await this.genres.findByName(input.name);
            if (byName !== null && byName.id !== id) {
                throw HttpError.conflict('Ya existe un género con ese nombre');
            }
            const bySlug = await this.genres.findBySlug(slug);
            if (bySlug !== null && bySlug.id !== id) {
                throw HttpError.conflict('Ya existe un género con ese slug');
            }
            patch.name = input.name;
            patch.slug = slug;
        }
        const updated = await this.genres.updateById(id, patch);
        if (updated === null) {
            throw HttpError.notFound('Género no encontrado');
        }
        return toDTO(updated);
    }
    async remove(id) {
        const current = await this.genres.findById(id);
        if (current === null) {
            throw HttpError.notFound('Género no encontrado');
        }
        const linked = await this.books.countByGenre(id);
        if (linked > 0) {
            throw HttpError.conflict('No se puede borrar un género que tiene libros asociados');
        }
        await this.genres.deleteById(id);
    }
}
