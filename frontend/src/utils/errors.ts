import { isApiError } from '@/types';

/**
 * Lee el mensaje de error de un campo desde el detalle estructurado de la
 * API cuando lo incluye (p. ej. `details.fieldErrors` de Zod), sin `any`.
 */
export function extractFieldError(error: unknown, field: string): string | undefined {
  if (!isApiError(error)) return undefined;
  const details: unknown = error.details;
  if (typeof details !== 'object' || details === null) return undefined;

  const record = details as Record<string, unknown>;
  const nested = record['fieldErrors'];
  const raw: unknown =
    typeof nested === 'object' && nested !== null
      ? (nested as Record<string, unknown>)[field]
      : record[field];

  if (Array.isArray(raw)) {
    const first = raw[0];
    if (typeof first === 'string') return first;
    return undefined;
  }
  return typeof raw === 'string' ? raw : undefined;
}

/** Mensaje legible para el usuario a partir de un error cualquiera. */
export function apiErrorMessage(
  error: unknown,
  fallback = 'Algo salió mal. Inténtalo de nuevo.'
): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error && error.message !== '') return error.message;
  return fallback;
}