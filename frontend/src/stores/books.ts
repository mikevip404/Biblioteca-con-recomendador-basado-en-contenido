import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { booksApi } from '@/api/booksApi';
import type { BookDTO, BookListQuery, BookPage } from '@/types';

/** TTL corto del caché de consultas del catálogo. */
const CACHE_TTL_MS = 30_000;
/** Si la consulta solo pide datos en caché y no caducan, no se vuelve a pedir. */
const SKIP_IF_FRESH = true;

interface QueryCacheEntry {
  ids: string[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  fetchedAt: number;
}

/** Serialización estable de la consulta (clave de caché y de estado). */
export function buildQueryKey(query: BookListQuery): string {
  const sorted: Array<[string, string | number]> = Object.entries(query)
    .filter((entry): entry is [string, string | number] => {
      const value = entry[1];
      return value !== undefined && value !== null && value !== '';
    })
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  return JSON.stringify(sorted);
}

/**
 * Catálogo normalizado por id (byId) + listas de ids por consulta.
 * Guarda paginación, totales y expiración corta para evitar peticiones
 * repetidas entre navegaciones rápidas.
 */
export const useBooksStore = defineStore('books', () => {
  const byId = ref<Record<string, BookDTO>>({});
  const queries = ref<Record<string, QueryCacheEntry>>({});
  const loadingKeys = ref<Set<string>>(new Set());
  const errorByKey = ref<Record<string, string>>({});

  const allBooks = computed(() => Object.values(byId.value));

  function queryKey(query: BookListQuery): string {
    return buildQueryKey(query);
  }

  function hasFreshCache(key: string): boolean {
    const entry = queries.value[key];
    if (entry === undefined) return false;
    return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
  }

  function isLoading(key: string): boolean {
    return loadingKeys.value.has(key);
  }

  function errorFor(key: string): string | undefined {
    return errorByKey.value[key];
  }

  function pageFor(key: string): QueryCacheEntry | undefined {
    return queries.value[key];
  }

  /** Lista de libros de la consulta (ids → byId), conservando el orden del backend. */
  function listFor(key: string): BookDTO[] {
    const entry = queries.value[key];
    if (entry === undefined) return [];
    const result: BookDTO[] = [];
    for (const id of entry.ids) {
      const book = byId.value[id];
      if (book !== undefined) result.push(book);
    }
    return result;
  }

  function seedBook(book: BookDTO): void {
    byId.value[book.id] = book;
  }

  /** Trae una página. Devuelve el resultado y deja caché fresca para el resto. */
  async function fetchBooks(query: BookListQuery): Promise<BookPage> {
    const key = queryKey(query);
    if (SKIP_IF_FRESH && hasFreshCache(key)) {
      const entry = queries.value[key];
      if (entry !== undefined) {
        return {
          data: listFor(key),
          page: entry.page,
          limit: entry.limit,
          total: entry.total,
          totalPages: entry.totalPages
        };
      }
    }

    loadingKeys.value.add(key);
    const previousError = errorByKey.value[key];
    if (previousError !== undefined) {
      delete errorByKey.value[key];
    }

    try {
      const page = await booksApi.list(query);
      for (const book of page.data) {
        seedBook(book);
      }
      queries.value[key] = {
        ids: page.data.map((book) => book.id),
        page: page.page,
        limit: page.limit,
        total: page.total,
        totalPages: page.totalPages,
        fetchedAt: Date.now()
      };
      return page;
    } catch (err) {
      errorByKey.value[key] =
        err instanceof Error ? err.message : 'No se pudo cargar el catálogo';
      throw err;
    } finally {
      loadingKeys.value.delete(key);
    }
  }

  /** Detalle de un libro (usa/normaliza el byId). */
  async function fetchBook(id: string): Promise<BookDTO> {
    const cached = byId.value[id];
    if (cached !== undefined && hasFreshCache(`book:${id}`)) {
      return cached;
    }
    const book = await booksApi.getById(id);
    seedBook(book);
    queries.value[`book:${id}`] = {
      ids: [id],
      page: 1,
      limit: 1,
      total: 1,
      totalPages: 1,
      fetchedAt: Date.now()
    };
    return book;
  }

  function getBook(id: string): BookDTO | undefined {
    return byId.value[id];
  }

  function invalidate(): void {
    queries.value = {};
  }

  return {
    byId,
    allBooks,
    queryKey,
    isLoading,
    errorFor,
    pageFor,
    listFor,
    getBook,
    fetchBooks,
    fetchBook,
    seedBook,
    invalidate
  };
});