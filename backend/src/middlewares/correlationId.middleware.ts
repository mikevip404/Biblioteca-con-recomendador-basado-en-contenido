import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Asigna un x-correlation-id a cada petición (o reutiliza el que llegó en el
 * header). Se propaga en la respuesta y a los logs para poder trazar una
 * solicitud a través del sistema.
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers['x-correlation-id'];
  const incoming = Array.isArray(header) ? header[0] : header;
  const correlationId = incoming ?? randomUUID();
  res.setHeader('x-correlation-id', correlationId);
  req.correlationId = correlationId;
  next();
}
