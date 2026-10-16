import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../utils/logger.js';

/**
 * Log estructurado al finalizar cada petición: método, ruta, status y tiempo.
 * Se usa el evento 'finish' de la respuesta para tener el status real.
 */
export function requestLoggerMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('request', {
        correlationId: req.correlationId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start
      });
    });
    next();
  };
}
