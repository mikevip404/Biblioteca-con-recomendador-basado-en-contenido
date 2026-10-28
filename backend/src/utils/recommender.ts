import type { Book } from '../types/catalog.js';
import type { SimilarityReasonDTO } from '../types/recommender.js';

/**
 * Motor de similitud por contenido. Implementado a mano (sin librerías de ML):
 * cada libro se representa como un vector disperso de características y la
 * afinidad entre dos libros es el coseno del ángulo entre sus vectores.
 */

/** Tipos de característica que forman el vector de un libro. */
export type FeatureType = 'genre' | 'tag' | 'author' | 'language' | 'era' | 'pages';

/** Vector disperso: token de característica → peso. */
export type FeatureVector = Map<string, number>;

/** Nombres legibles para resolver las etiquetas de los motivos. */
export interface FeatureNames {
  genres: Map<string, string>;
  authors: Map<string, string>;
}

/** Peso base por tipo antes de aplicar la frecuencia inversa (IDF). */
const BASE_WEIGHTS: Record<FeatureType, number> = {
  genre: 1,
  tag: 0.8,
  author: 0.6,
  language: 0.3,
  era: 0.3,
  pages: 0.2
};

const REASON_LIMIT = 3;

function pageBucket(pages: number): string {
  if (pages < 200) return 'corto';
  if (pages <= 350) return 'medio';
  if (pages <= 500) return 'largo';
  return 'muy-largo';
}

function eraBucket(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

function featureType(token: string): FeatureType {
  const separator = token.indexOf(':');
  const type = separator === -1 ? token : token.slice(0, separator);
  switch (type) {
    case 'genre':
    case 'tag':
    case 'author':
    case 'language':
    case 'era':
    case 'pages':
      return type;
    default:
      return 'tag';
  }
}

function featureValue(token: string): string {
  const separator = token.indexOf(':');
  return separator === -1 ? token : token.slice(separator + 1);
}

/** Tokens únicos que describen un libro (sin repetir géneros ni tags). */
export function bookTokens(book: Book): string[] {
  const tokens = new Set<string>();
  for (const genreId of book.genreIds) tokens.add(`genre:${genreId}`);
  for (const tag of book.tags) tokens.add(`tag:${tag}`);
  if (book.authorId !== '') tokens.add(`author:${book.authorId}`);
  if (book.language !== undefined && book.language !== '') {
    tokens.add(`language:${book.language.toLowerCase()}`);
  }
  if (book.publishedYear !== undefined) {
    tokens.add(`era:${eraBucket(book.publishedYear)}`);
  }
  if (book.pages !== undefined) {
    tokens.add(`pages:${pageBucket(book.pages)}`);
  }
  return [...tokens];
}

/**
 * Frecuencia inversa de documento suavizada: las características raras
 * (p. ej. un tag poco frecuente) pesan más que las muy comunes.
 */
export function buildCorpusIdf(books: Book[]): Map<string, number> {
  const documentFrequency = new Map<string, number>();
  for (const book of books) {
    for (const token of bookTokens(book)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  const total = books.length;
  for (const [token, frequency] of documentFrequency) {
    idf.set(token, Math.log((total + 1) / (frequency + 1)) + 1);
  }
  return idf;
}

/** Construye el vector ponderado de un libro (con IDF opcional). */
export function buildBookVector(
  book: Book,
  idf?: Map<string, number>
): FeatureVector {
  const vector: FeatureVector = new Map();
  for (const token of bookTokens(book)) {
    const base = BASE_WEIGHTS[featureType(token)];
    const weight = base * (idf?.get(token) ?? 1);
    if (weight > 0) vector.set(token, weight);
  }
  return vector;
}

/** Norma euclídea del vector. */
export function vectorNorm(vector: FeatureVector): number {
  let sum = 0;
  for (const weight of vector.values()) sum += weight * weight;
  return Math.sqrt(sum);
}

/** Similitud de coseno en [0, 1]; 0 si alguno de los vectores es nulo. */
export function cosineSimilarity(a: FeatureVector, b: FeatureVector): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [token, weight] of small) {
    const other = large.get(token);
    if (other !== undefined) dot += weight * other;
  }
  if (dot === 0) return 0;
  const denominator = vectorNorm(a) * vectorNorm(b);
  if (denominator === 0) return 0;
  return Math.min(1, Math.max(0, dot / denominator));
}

/** Suma ponderada de vectores (perfil del usuario a partir de sus libros). */
export function weightedSum(
  entries: ReadonlyArray<{ vector: FeatureVector; weight: number }>
): FeatureVector {
  const result: FeatureVector = new Map();
  for (const { vector, weight } of entries) {
    if (weight <= 0) continue;
    for (const [token, value] of vector) {
      result.set(token, (result.get(token) ?? 0) + value * weight);
    }
  }
  return result;
}

function defaultLabel(token: string, names: FeatureNames): string {
  const value = featureValue(token);
  switch (featureType(token)) {
    case 'genre': {
      const name = names.genres.get(value);
      return name === undefined ? 'Mismo género' : `Género: ${name}`;
    }
    case 'tag':
      return `Etiqueta: ${value}`;
    case 'author': {
      const name = names.authors.get(value);
      return name === undefined ? 'Mismo autor' : `Autor: ${name}`;
    }
    case 'language':
      return `Idioma: ${value.toUpperCase()}`;
    case 'era':
      return `Época: ${value}`;
    case 'pages':
      return 'Extensión similar';
    default:
      return 'Característica en común';
  }
}

/**
 * Motivos de afinidad entre dos vectores: las características compartidas
 * que más contribuyen al producto escalar (de mayor a menor).
 */
export function sharedReasons(
  a: FeatureVector,
  b: FeatureVector,
  names: FeatureNames,
  limit: number = REASON_LIMIT
): SimilarityReasonDTO[] {
  const shared: Array<{ token: string; contribution: number }> = [];
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [token, weight] of small) {
    const other = large.get(token);
    if (other === undefined) continue;
    const contribution = weight * other;
    if (contribution > 0) shared.push({ token, contribution });
  }
  shared.sort((left, right) => right.contribution - left.contribution);
  return shared.slice(0, limit).map(({ token }) => ({
    type: featureType(token),
    label: defaultLabel(token, names)
  }));
}
