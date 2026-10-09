import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './error.middleware.js';
import type { UserRole } from '../types/auth.js';

/**
 * Restringe por rol. Debe usarse DESPUÉS de `authenticate`.
 * Ejemplo: `router.get('/admin', authenticate(ts), authorize('admin'), ...)`.
 */
export function authorize(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (user === undefined) {
      next(HttpError.unauthorized('Se requiere autenticación'));
      return;
    }
    if (!allowed.includes(user.role)) {
      next(HttpError.forbidden('No tienes permiso para este recurso'));
      return;
    }
    next();
  };
}
