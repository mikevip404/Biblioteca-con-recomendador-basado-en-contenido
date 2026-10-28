import type { Document } from 'mongodb';
import type { MongoDatabase } from '../db/mongo.js';
import { MongoAuthorRepository } from '../repositories/author.repository.js';
import { MongoBookRepository } from '../repositories/book.repository.js';
import { MongoFavoriteRepository } from '../repositories/favorite.repository.js';
import { MongoGenreRepository } from '../repositories/genre.repository.js';
import { MongoRatingRepository } from '../repositories/rating.repository.js';
import { MongoUserRepository } from '../repositories/user.repository.js';
import { slugify } from '../utils/slug.js';
import { Argon2PasswordService } from './password.service.js';
import { recalculateRatingCounters } from './rating-recalc.js';

export interface SeedResult {
  genresCreated: number;
  authorsCreated: number;
  booksCreated: number;
  readersCreated: number;
  ratingsCreated: number;
  favoritesCreated: number;
  totals: {
    genres: number;
    authors: number;
    books: number;
    readers: number;
    ratings: number;
    favorites: number;
  };
}

const GENRE_SEEDS: ReadonlyArray<{ name: string; description: string }> = [
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

/** Lectores sintéticos con preferencias, para probar el recomendador (Fase 5). */
const LECTOR_COUNT = 20;
const LECTOR_PASSWORD = 'Lector1234';
const RATING_COMMENTS = [
  'Una lectura absorbente.',
  'Personajes muy bien construidos.',
  'El ritmo decae a mitad de camino.',
  'Me ha encantado el final.',
  'Correcta sin más.'
];

interface SyntheticBook {
  title: string;
  description: string;
  tags: string[];
  publishedYear: number;
  pages: number;
  language: string;
  isbn: string;
  coverUrl: string;
}

interface SeedBook {
  id: string;
  genreIds: string[];
}

function buildBooks(): SyntheticBook[] {
  return Array.from({ length: 150 }, (_unused, index) => {
    const tagCount = 2 + (index % 4);
    const tags: string[] = [];
    for (let offset = 0; offset < tagCount; offset++) {
      const tag = TAG_POOL[(index * 3 + offset * 7) % TAG_POOL.length];
      if (tag !== undefined && !tags.includes(tag)) tags.push(tag);
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

function toSeedBook(doc: Document): SeedBook {
  const genres = doc['genres'];
  return {
    id: String(doc['_id']),
    genreIds: Array.isArray(genres) ? genres.map((value) => String(value)) : []
  };
}

/**
 * Siembra el catálogo de forma idempotente (géneros/autores por nombre,
 * libros por ISBN determinista). `createdById` es el admin que figura como
 * creador de los libros sintéticos.
 */
export async function seedCatalog(
  db: MongoDatabase,
  createdById: string
): Promise<SeedResult> {
  const genres = new MongoGenreRepository(db);
  const authors = new MongoAuthorRepository(db);
  const books = new MongoBookRepository(db);

  let genresCreated = 0;
  for (const seed of GENRE_SEEDS) {
    if ((await genres.findByName(seed.name)) !== null) continue;
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
    const lastName =
      LAST_NAMES[(index * 7 + Math.floor(index / 10)) % LAST_NAMES.length] ??
      'Anónimo';
    const name = `${firstName} ${lastName}`;
    if ((await authors.findByName(name)) !== null) continue;
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
    if ((await books.findByIsbn(seed.isbn)) !== null) continue;
    const index = Number(seed.isbn.slice(-4));
    const author = allAuthors[index % allAuthors.length];
    const firstGenre = allGenres[index % allGenres.length];
    const secondGenre = allGenres[(index * 5 + 3) % allGenres.length];
    if (author === undefined || firstGenre === undefined) continue;
    const genreIds =
      secondGenre !== undefined && secondGenre.id !== firstGenre.id
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

   if (allGenres.length === 0 || seedBooks.length === 0) continue;

    // Preferencia por 2 géneros consecutivos (determinista).
    const first = allGenres[(index * 2) % allGenres.length];
    const second = allGenres[(index * 2 + 1) % allGenres.length];
    const preferred = new Set(
      [first?.id, second?.id].filter((id): id is string => id !== undefined)
    );
    const preferredBooks = seedBooks.filter((book) =>
      book.genreIds.some((id) => preferred.has(id))
    );
    const otherBooks = seedBooks.filter(
      (book) => !book.genreIds.some((id) => preferred.has(id))
    );
    const ordered = [...preferredBooks, ...otherBooks];
    const target = 10 + ((index * 7) % 31); // 10..40 valoraciones

    for (let k = 0; k < ordered.length && k < target; k++) {
      const book = ordered[k];
      if (book === undefined) continue;
      const isPreferred = book.genreIds.some((id) => preferred.has(id));
      // Valores altos en géneros preferidos; medios en el resto.
      const value = isPreferred ? 4 + ((index + k) % 2) : 2 + ((index + k) % 2);

      if ((await ratings.findByUserAndBook(reader.id, book.id)) === null) {
        const comment =
          k % 5 === 0 ? RATING_COMMENTS[k % RATING_COMMENTS.length] : undefined;
        await ratings.insert(reader.id, book.id, value, comment);
        ratingsCreated++;
      }
      if (k % 3 === 0 && !(await favorites.exists(reader.id, book.id))) {
        await favorites.add(reader.id, book.id);
        favoritesCreated++;
      }
    }
  }

  // Los contadores quedan correctos aunque la semilla se re-ejecute.
  await recalculateRatingCounters(db);

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
    readersCreated,
    ratingsCreated,
    favoritesCreated,
    totals: {
      genres: allGenres.length,
      authors: allAuthors.length,
      books: result.total,
      readers: await db.countDocuments('users', { role: 'lector' }),
      ratings: await db.countDocuments('ratings'),
      favorites: await db.countDocuments('favorites')
    }
  };
}
