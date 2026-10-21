import { z } from 'zod';
import { objectIdSchema } from './catalog.schemas.js';

/**
 * Esquemas de entrada de valoraciones y favoritos. Todos son `strict`:
 * cualquier campo desconocido hace fallar la validación. El `userId` NUNCA
 * se acepta desde el cliente (sale del token).
 */

export const bookIdParamSchema = z.object({ bookId: objectIdSchema }).strict();

export type BookIdParam = z.infer<typeof bookIdParamSchema>;

export const ratingIdParamSchema = z.object({ id: objectIdSchema }).strict();

export type RatingIdParam = z.infer<typeof ratingIdParamSchema>;

/** Cuerpo de `PUT /books/:bookId/rating`: valor entero 1–5 y comentario. */
export const ratingBodySchema = z
  .object({
    value: z.coerce
      .number()
      .int('La valoración debe ser un entero entre 1 y 5')
      .min(1, 'La valoración mínima es 1')
      .max(5, 'La valoración máxima es 5'),
    comment: z
      .string()
      .trim()
      .max(500, 'El comentario no puede superar los 500 caracteres')
      .optional()
      .transform((value) => (value === undefined || value === '' ? undefined : value))
  })
  .strict();

export type RatingBodyInput = z.infer<typeof ratingBodySchema>;

/** Query de paginación de listados de valoraciones/favoritos. */
export const ratingsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export type RatingsQueryInput = z.infer<typeof ratingsQuerySchema>;
