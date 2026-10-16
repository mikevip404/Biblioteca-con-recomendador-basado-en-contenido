import { ObjectId, type Document } from 'mongodb';
import type {
  BookFilter,
  BookSortField,
  Paginated,
  SortOrder
} from '../types/catalog.js';

/** Tope duro de elementos por página (evita respuestas gigantes). */
export const MAX_PAGE_SIZE = 50;

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

function toObjectId(value: string): ObjectId | null {
  if (!ObjectId.isValid(value)) return null;
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

/** Normaliza página y límite (1..MAX_PAGE_SIZE) y calcula el `skip`. */
export function buildPagination(page: number, limit: number): Pagination {
  const safePage = Number.isFinite(page) ? Math.max(Math.trunc(page), 1) : 1;
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE)
    : MAX_PAGE_SIZE;
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

/**
 * Expresión de Mongo para `averageRating` (virtual): `ratingSum / ratingCount`,
 * o 0 si aún no hay valoraciones. Se reutiliza en `$expr` y en agregaciones.
 */
export const averageRatingExpression: Document = {
  $cond: [{ $eq: ['$ratingCount', 0] }, 0, { $divide: ['$ratingSum', '$ratingCount'] }]
};

/** Orden estable por un campo persistido y `_id` como desempate. */
export function buildSort(
  field: Exclude<BookSortField, 'averageRating'>,
  order: SortOrder
): Record<string, 1 | -1> {
  return { [field]: order === 'asc' ? 1 : -1, _id: 1 };
}

/**
 * Traduce los filtros normalizados del listado a un filtro de Mongo.
 * Los ids inválidos se ignoran (Zod ya los validó en el borde HTTP).
 */
export function buildBookFilter(filter: BookFilter): Document {
  const query: Document = {};
  if (filter.q !== undefined && filter.q !== '') {
    query['$text'] = { $search: filter.q };
  }
  if (filter.genreId !== undefined) {
    const genreId = toObjectId(filter.genreId);
    if (genreId !== null) query['genres'] = genreId;
  }
  if (filter.authorId !== undefined) {
    const authorId = toObjectId(filter.authorId);
    if (authorId !== null) query['author'] = authorId;
  }
  if (filter.yearFrom !== undefined || filter.yearTo !== undefined) {
    const range: Document = {};
    if (filter.yearFrom !== undefined) range['$gte'] = filter.yearFrom;
    if (filter.yearTo !== undefined) range['$lte'] = filter.yearTo;
    query['publishedYear'] = range;
  }
  if (filter.language !== undefined && filter.language !== '') {
    query['language'] = filter.language;
  }
  if (filter.minRating !== undefined) {
    query['$expr'] = { $gte: [averageRatingExpression, filter.minRating] };
  }
  return query;
}

/** Envuelve los resultados con los metadatos de paginación. */
export function paginate<T>(
  data: T[],
  total: number,
  pagination: Pagination
): Paginated<T> {
  return {
    data,
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / pagination.limit)
  };
}
