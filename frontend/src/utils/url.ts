import type { LocationQuery, LocationQueryValue } from 'vue-router';

import type { BookListQuery, BookSortField, SortOrder } from '@/types';

const VALID_SORTS: readonly BookSortField[] = [
  'title',
  'publishedYear',
  'createdAt',
  'averageRating'
];
const VALID_ORDERS: readonly SortOrder[] = ['asc', 'desc'];

function firstValue(
  value: LocationQueryValue | LocationQueryValue[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    const head: LocationQueryValue | undefined = value[0];
    if (head === null) return undefined;
    return head;
  }
  if (value === undefined || value === null || value === '') return undefined;
  return value;
}

function readInt(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
  min: number,
  max: number
): number | undefined {
  const raw = firstValue(value);
  if (raw === undefined) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

/** Convierte la `query` de la URL a los filtros tipados del catálogo. */
export function queryToBookQuery(query: LocationQuery): BookListQuery {
  const result: BookListQuery = {};

  const page = readInt(query['page'], 1, Number.MAX_SAFE_INTEGER);
  if (page !== undefined) result.page = page;

  const limit = readInt(query['limit'], 1, 50);
  if (limit !== undefined) result.limit = limit;

  const sort = firstValue(query['sort']);
  if (sort !== undefined && VALID_SORTS.includes(sort as BookSortField)) {
    result.sort = sort as BookSortField;
  }

  const order = firstValue(query['order']);
  if (order !== undefined && VALID_ORDERS.includes(order as SortOrder)) {
    result.order = order as SortOrder;
  }

  const genre = firstValue(query['genre']);
  if (genre !== undefined) result.genre = genre;

  const author = firstValue(query['author']);
  if (author !== undefined) result.author = author;

  const yearFrom = readInt(query['yearFrom'], 0, 2100);
  if (yearFrom !== undefined) result.yearFrom = yearFrom;

  const yearTo = readInt(query['yearTo'], 0, 2100);
  if (yearTo !== undefined) result.yearTo = yearTo;

  const minRating = readInt(query['minRating'], 1, 5);
  if (minRating !== undefined) result.minRating = minRating;

  const language = firstValue(query['language']);
  if (language !== undefined) result.language = language;

  const q = firstValue(query['q']);
  if (q !== undefined) result.q = q;

  return result;
}

/** Convierte filtros tipados a una `query` de URL (para poder compartir/recargar). */
export function bookQueryToQuery(
  query: Record<string, string | number | undefined>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(query)) {
    const value = query[key];
    if (value === undefined || value === '') continue;
    result[key] = String(value);
  }
  return result;
}