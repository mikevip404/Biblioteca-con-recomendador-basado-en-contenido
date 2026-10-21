import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import {
  buildBookFilter,
  buildPagination,
  buildSort,
  MAX_PAGE_SIZE,
  paginate
} from '../../src/repositories/query.builder.js';

describe('buildPagination', () => {
  it('calcula el skip y normaliza valores mínimos', () => {
    expect(buildPagination(3, 10)).toEqual({ page: 3, limit: 10, skip: 20 });
    expect(buildPagination(0, 0)).toEqual({ page: 1, limit: 1, skip: 0 });
  });

  it('acota el límite al máximo permitido', () => {
    expect(buildPagination(1, 500).limit).toBe(MAX_PAGE_SIZE);
  });
});

describe('buildSort', () => {
  it('aplica dirección y desempata por _id', () => {
    expect(buildSort('title', 'asc')).toEqual({ title: 1, _id: 1 });
    expect(buildSort('publishedYear', 'desc')).toEqual({ publishedYear: -1, _id: 1 });
  });
});

describe('buildBookFilter', () => {
  it('compone texto, referencias, rango de año y lenguaje', () => {
    const genreId = new ObjectId().toString();
    const authorId = new ObjectId().toString();
    const filter = buildBookFilter({
      q: 'python',
      genreId,
      authorId,
      yearFrom: 2000,
      yearTo: 2020,
      language: 'es'
    });

    expect(filter['$text']).toEqual({ $search: 'python' });
    expect(String(filter['genres'])).toBe(genreId);
    expect(String(filter['author'])).toBe(authorId);
    expect(filter['publishedYear']).toEqual({ $gte: 2000, $lte: 2020 });
    expect(filter['language']).toBe('es');
  });

  it('ignora ids inválidos y campos vacíos', () => {
    expect(buildBookFilter({ genreId: 'no-valido', language: '' })).toEqual({});
  });
});

describe('paginate', () => {
  it('calcula totalPages y conserva metadatos', () => {
    const result = paginate([1, 2], 5, { page: 1, limit: 2, skip: 0 });
    expect(result).toEqual({
      data: [1, 2],
      total: 5,
      page: 1,
      limit: 2,
      totalPages: 3
    });
  });

  it('totalPages es 0 sin resultados', () => {
    expect(paginate([], 0, { page: 1, limit: 10, skip: 0 }).totalPages).toBe(0);
  });
});
