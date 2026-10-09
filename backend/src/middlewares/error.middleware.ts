import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../utils/logger.js';

/**
 * Error con status y código de negocio. Todo error controlado de la API
 * debería ser un HttpError; cualquier otro se responde como 500 genérico
 * (sin filtrar detalles internos al cliente).
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }

  static notFound(message = 'Recurso no encontrado'): HttpError {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static internal(message = 'Error interno del servidor'): HttpError {
    return new HttpError(500, 'INTERNAL_ERROR', message);
  }
}

/** Convierte rutas no encontradas en un HttpError 404. */
export function notFoundMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(HttpError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

/** Manejador global de errores: log estructurado + respuesta JSON uniforme. */
export function errorMiddleware(logger: Logger) {
  return (
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    const correlationId = req.correlationId;

    if (err instanceof HttpError) {
      logger.warn(err.message, {
        correlationId,
        status: err.status,
        code: err.code
      });
      res.status(err.status).json({
        error: { code: err.code, message: err.message, correlationId }
      });
      return;
    }

    const message = err instanceof Error ? err.message : 'Error desconocido';
    logger.error(message, {
      correlationId,
      stack: err instanceof Error ? err.stack : undefined
    });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor', correlationId }
    });
  };
}
