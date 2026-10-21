import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import {
  bookQuerySchema,
  createAuthorSchema,
  createBookSchema,
  objectIdSchema,
  tagsSchema,
  updateBookSchema
} from '../../src/schemas/catalog.schemas.js';

const validId = new ObjectId().toString();

describe('objectIdSchema', () => {
  it('acepta un ObjectId de 24 hex y rechaza el resto', () => {
    expect(objectIdSchema.safeParse(validId).success).toBe(true);
    expect(objectIdSchema.safeParse('123').success).toBe(false);
    expect(objectIdSchema.safeParse('zzzzzzzzzzzzzzzzzzzzzzzz').success).toBe(false);
  });
});

describe('tagsSchema', () => {
  it('normaliza a minúsculas, recorta y elimina duplicados', () => {
    const result = tagsSchema.parse([' Uno ', 'uno', 'DOS']);
    expect(result).toEqual(['uno', 'dos']);
  });

  it('rechaza más de 15 tags o tags de más de 30 caracteres', () => {
    const sixteen = Array.from({ length: 16 }, (_unused, index) => `tag-${index}`);
    expect(tagsSchema.safeParse(sixteen).success).toBe(false);
    expect(tagsSchema.safeParse(['x'.repeat(31)]).success).toBe(false);
  });
});

describe('createAuthorSchema', () => {
  it('rechaza campos desconocidos (strict)', () => {
    expect(
      createAuthorSchema.safeParse({ name: 'Ana', role: 'admin' }).success
    ).toBe(false);
  });

  it('exige el nombre', () => {
    expect(createAuthorSchema.safeParse({ bio: 'x' }).success).toBe(false);
    expect(createAuthorSchema.safeParse({ name: '  ' }).success).toBe(false);
  });
});

describe('createBookSchema', () => {
  it('exige al menos un género y un autor válido', () => {
    expect(
      createBookSchema.safeParse({ title: 'T', author: validId, genres: [] }).success
    ).toBe(false);
    expect(
      createBookSchema.safeParse({ title: 'T', author: 'malo', genres: [validId] }).success
    ).toBe(false);
  });

  it('acepta un libro válido y normaliza tags', () => {
    const result = createBookSchema.parse({
      title: '  Libro  ',
      author: validId,
      genres: [validId],
      tags: ['A', 'a', 'B']
    });
    expect(result.title).toBe('Libro');
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('rechaza campos desconocidos', () => {
    expect(
      createBookSchema.safeParse({
        title: 'T',
        author: validId,
        genres: [validId],
        createdBy: validId
      }).success
    ).toBe(false);
  });
});

describe('updateBookSchema', () => {
  it('permite actualizaciones parciales y conserva la normalización de tags', () => {
    const result = updateBookSchema.parse({ tags: ['X', 'x'] });
    expect(result.tags).toEqual(['x']);
  });
});

describe('bookQuerySchema', () => {
  it('aplica valores por defecto', () => {
    const result = bookQuerySchema.parse({});
    expect(result).toEqual({ page: 1, limit: 20, sort: 'createdAt', order: 'desc' });
  });

  it('convierte números y rechaza limit > 50 o campos desconocidos', () => {
    expect(bookQuerySchema.parse({ page: '2', limit: '10' })).toMatchObject({
      page: 2,
      limit: 10
    });
    expect(bookQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(bookQuerySchema.safeParse({ foo: 'bar' }).success).toBe(false);
  });
});
