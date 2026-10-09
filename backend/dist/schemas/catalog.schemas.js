import { z } from 'zod';
/**
 * Esquemas de entrada del catálogo. Todos son `strict`: cualquier campo
 * desconocido hace fallar la validación (evita mass assignment).
 */
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
export const objectIdSchema = z
    .string()
    .regex(OBJECT_ID_REGEX, 'Debe ser un ObjectId válido de 24 caracteres hex');
export const idParamSchema = z.object({ id: objectIdSchema }).strict();
/** Tags: minúsculas, sin espacios sobrantes, sin duplicados, máx. 15 de 30. */
export const tagsSchema = z
    .array(z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'El tag no puede estar vacío')
    .max(30, 'El tag no puede superar los 30 caracteres'))
    .max(15, 'No se permiten más de 15 tags')
    .transform((tags) => [...new Set(tags)]);
// --- Autores ---
export const createAuthorSchema = z
    .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
    bio: z.string().trim().max(2000).optional(),
    birthYear: z.coerce.number().int().min(0).max(2100).optional(),
    country: z.string().trim().max(100).optional()
})
    .strict();
export const updateAuthorSchema = createAuthorSchema.partial();
// --- Géneros ---
export const createGenreSchema = z
    .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
    description: z.string().trim().max(2000).optional()
})
    .strict();
export const updateGenreSchema = createGenreSchema.partial();
// --- Libros ---
export const createBookSchema = z
    .object({
    title: z.string().trim().min(1, 'El título es obligatorio').max(300),
    description: z.string().trim().max(5000).optional(),
    author: objectIdSchema,
    genres: z
        .array(objectIdSchema)
        .min(1, 'Se requiere al menos un género')
        .max(10, 'No se permiten más de 10 géneros'),
    tags: tagsSchema.optional(),
    publishedYear: z.coerce.number().int().min(0).max(2100).optional(),
    pages: z.coerce.number().int().min(1).max(100000).optional(),
    language: z.string().trim().min(2).max(50).optional(),
    isbn: z.string().trim().min(10).max(20).optional(),
    coverUrl: z.string().trim().url('URL de portada inválida').max(500).optional()
})
    .strict();
export const updateBookSchema = createBookSchema.partial();
/** Query del listado: página, orden, filtros y búsqueda de texto. */
export const bookQuerySchema = z
    .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    sort: z.enum(['title', 'publishedYear', 'createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    genre: objectIdSchema.optional(),
    author: objectIdSchema.optional(),
    yearFrom: z.coerce.number().int().min(0).max(2100).optional(),
    yearTo: z.coerce.number().int().min(0).max(2100).optional(),
    language: z.string().trim().min(1).max(50).optional(),
    q: z.string().trim().min(1).max(200).optional()
})
    .strict();
