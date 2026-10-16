import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './error.middleware.js';
import type { TokenService } from '../services/token.service.js';
import { InvalidTokenError } from '../services/token.service.js';

/**
 * Verifica el access token del header `Authorization: Bearer <token>` y
 * adjunta el usuario a la petición (`req.user`). Sin `any`: el tipo de
 * `req.user` está declarado en `src/types/express.d.ts`.
 */
export function authenticate(tokenService: TokenService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (header === undefined || !header.startsWith('Bearer ')) {
      next(HttpError.unauthorized('Falta el token de acceso'));
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    if (token === '') {
      next(HttpError.unauthorized('Falta el token de acceso'));
      return;
    }
    try {
      req.user = tokenService.verifyAccessToken(token);
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        next(HttpError.unauthorized(error.message));
        return;
      }
      next(error);
      return;
    }
    next();
  };
}
