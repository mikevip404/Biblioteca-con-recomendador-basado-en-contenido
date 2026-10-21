import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import {
  bookIdParamSchema,
  ratingBodySchema,
  ratingIdParamSchema,
  ratingsQuerySchema
} from '../../src/schemas/ratings.schemas.js';

const validId = new ObjectId().toString();

describe('ratingBodySchema', () => {
  it('acepta valores enteros de 1 a 5', () => {
    for (const value of [1, 2, 3, 4, 5]) {
      expect(ratingBodySchema.safeParse({ value }).success).toBe(true);
    }
  });

  it('rechaza valores fuera de rango, decimales y no numéricos', () => {
    expect(ratingBodySchema.safeParse({ value: 0 }).success).toBe(false);
    expect(ratingBodySchema.safeParse({ value: 6 }).success).toBe(false);
    expect(ratingBodySchema.safeParse({ value: 3.5 }).success).toBe(false);
    expect(ratingBodySchema.safeParse({ value: 'mucho' }).success).toBe(false);
    expect(ratingBodySchema.safeParse({}).success).toBe(false);
  });

  it('exige un entero aunque llegue como string numérico', () => {
    expect(ratingBodySchema.parse({ value: '4' }).value).toBe(4);
    expect(ratingBodySchema.safeParse({ value: '4.5' }).success).toBe(false);
  });

  it('recorta el comentario y convierte vacío en ausente', () => {
    expect(ratingBodySchema.parse({ value: 5, comment: '  Bueno  ' }).comment).toBe('Bueno');
    expect(ratingBodySchema.parse({ value: 5, comment: '   ' }).comment).toBeUndefined();
    expect(ratingBodySchema.parse({ value: 5 }).comment).toBeUndefined();
  });

  it('rechaza comentarios de más de 500 caracteres', () => {
    expect(
      ratingBodySchema.safeParse({ value: 5, comment: 'x'.repeat(501) }).success
    ).toBe(false);
  });

  it('rechaza campos desconocidos y userId del cliente (strict)', () => {
    expect(
      ratingBodySchema.safeParse({ value: 5, userId: validId }).success
    ).toBe(false);
    expect(ratingBodySchema.safeParse({ value: 5, foo: 'bar' }).success).toBe(false);
  });
});

describe('params y query de valoraciones', () => {
  it('valida los ObjectId de params', () => {
    expect(bookIdParamSchema.safeParse({ bookId: validId }).success).toBe(true);
    expect(bookIdParamSchema.safeParse({ bookId: 'no' }).success).toBe(false);
    expect(ratingIdParamSchema.safeParse({ id: validId }).success).toBe(true);
    expect(ratingIdParamSchema.safeParse({ id: 'no' }).success).toBe(false);
  });

  it('aplica paginación por defecto y rechaza límites y claves extra', () => {
    expect(ratingsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(ratingsQuerySchema.parse({ page: '3', limit: '5' })).toEqual({
      page: 3,
      limit: 5
    });
    expect(ratingsQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(ratingsQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(ratingsQuerySchema.safeParse({ bookId: validId }).success).toBe(false);
  });
});
