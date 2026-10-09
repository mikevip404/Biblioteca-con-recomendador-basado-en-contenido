import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './error.middleware.js';

/**
 * Resuelve el id del dueño del recurso. Acepta resolutores síncronos
 * (p. ej. leer un param de ruta) o asíncronos (p. ej. consultar la BD).
 */
export type OwnerResolver = (
  req: Request
) => string | undefined | Promise<string | undefined>;

/**
 * Valida que el recurso pertenece al usuario autenticado. Debe usarse
 * DESPUÉS de `authenticate`. Los `admin` están exentos (pueden gestionar
 * recursos ajenos); los `lector` solo operan sobre lo propio.
 */
export function requireOwnership(resolveOwnerId: OwnerResolver) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next(HttpError.unauthorized('Se requiere autenticación'));
        return;
      }
      if (user.role === 'admin') {
        next();
        return;
      }
      const ownerId = await resolveOwnerId(req);
      if (ownerId === undefined || ownerId !== user.id) {
        next(HttpError.forbidden('No tienes permiso sobre este recurso'));
        return;
      }
      next();
    } catch (error) {
      // Express 4 no captura rechazos en middlewares async: se reenvían a mano.
      next(error);
    }
  };
}
