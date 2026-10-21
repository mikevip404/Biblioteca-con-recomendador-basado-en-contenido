/** Cuerpo del error uniforme que devuelve la API: `{ error: { code, message, correlationId } }`. */
export interface ApiErrorBody {
  code: string;
  message: string;
  correlationId?: string;
  /** Detalle adicional (p. ej. fieldErrors de Zod) si el backend algún día lo incluye. */
  details?: unknown;
}

/** Envoltura que viaja en el cuerpo de una respuesta con error. */
export interface ApiErrorPayload {
  error: ApiErrorBody;
}

/**
 * Type guard de errores de la API: comprueba (sin `any`) que un valor
 * desconocido tiene la forma `{ error: { code, message } }`.
 */
export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { error?: unknown };
  if (typeof candidate.error !== 'object' || candidate.error === null) return false;
  const body = candidate.error as { code?: unknown; message?: unknown };
  return typeof body.code === 'string' && typeof body.message === 'string';
}

/** Opciones opcionales del constructor de `ApiError`. */
export interface ApiErrorOptions {
  correlationId?: string;
  details?: unknown;
}

/** Error tipado del cliente HTTP lanzado ante respuestas de error de la API. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId?: string;
  /** Detalle adicional (p. ej. fieldErrors de Zod) si el backend algún día lo incluye. */
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    options: ApiErrorOptions = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (options.correlationId !== undefined) {
      this.correlationId = options.correlationId;
    }
    if (options.details !== undefined) {
      this.details = options.details;
    }
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/**
 * Opciones comunes de una petición del cliente HTTP. De momento solo la
 * señal de cancelación (`AbortController`), que las vistas usan para descartar
 * respuestas obsoletas al cambiar de ruta o de página.
 */
export interface ApiRequestOptions {
  signal?: AbortSignal;
}

/** Respuesta paginada estándar del catálogo. */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Envoltura de una entidad única (`{ data: T }`). */
export interface DataResponse<T> {
  data: T;
}
