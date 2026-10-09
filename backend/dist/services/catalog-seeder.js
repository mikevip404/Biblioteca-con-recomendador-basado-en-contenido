import { MongoAuthorRepository } from '../repositories/author.repository.js';
import { MongoBookRepository } from '../repositories/book.repository.js';
import { MongoGenreRepository } from '../repositories/genre.repository.js';
import { slugify } from '../utils/slug.js';
const GENRE_SEEDS = [
    { name: 'Ciencia ficción', description: 'Futuros posibles, tecnología y espacio.' },
    { name: 'Fantasía', description: 'Mundos mágicos y épicas.' },
    { name: 'Novela negra', description: 'Crimen, misterio y detectives.' },
    { name: 'Romance', description: 'Historias de amor y relaciones.' },
    { name: 'Historia', description: 'Pasado, civilizaciones y hechos.' },
    { name: 'Ciencia', description: 'Divulgación y pensamiento científico.' },
    { name: 'Filosofía', description: 'Pensamiento, ética y metafísica.' },
    { name: 'Poesía', description: 'Verso y expresión lírica.' },
    { name: 'Biografía', description: 'Vidas y memorias.' },
    { name: 'Infantil', description: 'Lecturas para los más pequeños.' },
    { name: 'Terror', description: 'Miedo y lo sobrenatural.' },
    { name: 'Aventura', description: 'Viajes, riesgo y descubrimiento.' }
];
const COUNTRIES = ['España', 'México', 'Argentina', 'Colombia', 'Chile', 'Perú', 'Uruguay', 'Francia'];
const FIRST_NAMES = ['Ana', 'Luis', 'Marta', 'Jorge', 'Elena', 'Pablo', 'Lucía', 'Diego', 'Sofía', 'Andrés'];
const LAST_NAMES = ['García', 'López', 'Martínez', 'Pérez', 'Gómez', 'Fernández', 'Ruiz', 'Díaz', 'Moreno', 'Álvarez'];
const TITLE_ADJECTIVES = ['El último', 'La sombra de', 'Crónica de', 'El jardín de', 'Los secretos de', 'La ciudad de', 'El eco de', 'La senda de'];
const TITLE_NOUNS = ['la tormenta', 'los espejos', 'las estrellas', 'el silencio', 'los relojes', 'la memoria', 'los nombres', 'el océano', 'las ruinas', 'el invierno'];
const TAG_POOL = [
    'aventura', 'misterio', 'espacio', 'magia', 'guerra', 'amor', 'viaje', 'futuro',
    'histórico', 'clásico', 'distopía', 'mar', 'montaña', 'intriga', 'familia',
    'amistad', 'revolución', 'arte', 'música', 'naturaleza'
];
const LANGUAGES = ['es', 'en', 'fr', 'pt'];
function buildBooks() {
    return Array.from({ length: 150 }, (_unused, index) => {
        const tagCount = 2 + (index % 4);
        const tags = [];
        for (let offset = 0; offset < tagCount; offset++) {
            const tag = TAG_POOL[(index * 3 + offset * 7) % TAG_POOL.length];
            if (tag !== undefined && !tags.includes(tag))
                tags.push(tag);
        }
        const adjective = TITLE_ADJECTIVES[index % TITLE_ADJECTIVES.length] ?? 'El libro de';
        const noun = TITLE_NOUNS[(index * 7) % TITLE_NOUNS.length] ?? 'lo desconocido';
        return {
            title: `${adjective} ${noun} (${index + 1})`,
            description: `Obra sintética número ${index + 1} para probar el catálogo y el recomendador.`,
            tags,
            publishedYear: 1950 + ((index * 7) % 75),
            pages: 80 + ((index * 13) % 900),
            language: LANGUAGES[index % LANGUAGES.length] ?? 'es',
            isbn: `978${(1_000_000_000 + index).toString()}`,
            coverUrl: `https://example.com/covers/${1_000_000_000 + index}.jpg`
        };
    });
}
/**
 * Siembra el catálogo de forma idempotente (géneros/autores por nombre,
 * libros por ISBN determinista). `createdById` es el admin que figura como
 * creador de los libros sintéticos.
 */
export async function seedCatalog(db, createdById) {
    const genres = new MongoGenreRepository(db);
    const authors = new MongoAuthorRepository(db);
    const books = new MongoBookRepository(db);
    let genresCreated = 0;
    for (const seed of GENRE_SEEDS) {
        if ((await genres.findByName(seed.name)) !== null)
            continue;
        await genres.create({
            name: seed.name,
            slug: slugify(seed.name),
            description: seed.description
        });
        genresCreated++;
    }
    let authorsCreated = 0;
    for (let index = 0; index < 30; index++) {
        const firstName = FIRST_NAMES[index % FIRST_NAMES.length] ?? 'Autor';
        // El índice del apellido rota dentro de cada bloque de 10 para que los
        // 30 pares (nombre, apellido) sean únicos.
        const lastName = LAST_NAMES[(index * 7 + Math.floor(index / 10)) % LAST_NAMES.length] ??
            'Anónimo';
        const name = `${firstName} ${lastName}`;
        if ((await authors.findByName(name)) !== null)
            continue;
        await authors.create({
            name,
            bio: `Biografía sintética de ${name}.`,
            birthYear: 1900 + ((index * 3) % 100),
            country: COUNTRIES[index % COUNTRIES.length] ?? 'España'
        });
        authorsCreated++;
    }
    const allAuthors = await authors.findAll();
    const allGenres = await genres.findAll();
    if (allAuthors.length === 0 || allGenres.length === 0) {
        throw new Error('No hay autores o géneros para asignar a los libros');
    }
    let booksCreated = 0;
    for (const seed of buildBooks()) {
        if ((await books.findByIsbn(seed.isbn)) !== null)
            continue;
        const index = Number(seed.isbn.slice(-4));
        const author = allAuthors[index % allAuthors.length];
        const firstGenre = allGenres[index % allGenres.length];
        const secondGenre = allGenres[(index * 5 + 3) % allGenres.length];
        if (author === undefined || firstGenre === undefined)
            continue;
        const genreIds = secondGenre !== undefined && secondGenre.id !== firstGenre.id
            ? [firstGenre.id, secondGenre.id]
            : [firstGenre.id];
        await books.create({
            title: seed.title,
            description: seed.description,
            authorId: author.id,
            genreIds,
            tags: seed.tags,
            publishedYear: seed.publishedYear,
            pages: seed.pages,
            language: seed.language,
            isbn: seed.isbn,
            coverUrl: seed.coverUrl,
            createdBy: createdById
        });
        booksCreated++;
    }
    const result = await books.findMany({
        filter: {},
        sort: 'createdAt',
        order: 'asc',
        page: 1,
        limit: 1
    });
    return {
        genresCreated,
        authorsCreated,
        booksCreated,
        totals: {
            genres: allGenres.length,
            authors: allAuthors.length,
            books: result.total
        }
    };
}
