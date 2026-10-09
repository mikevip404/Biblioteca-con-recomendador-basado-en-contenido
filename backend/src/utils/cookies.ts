import type { Response } from 'express';

/** Nombre de la cookie del refresh token. */
export const REFRESH_COOKIE_NAME = 'refresh_token';

export interface CookieSecurity {
  /** `Secure` solo en producción (en local suele usarse http). */
  secure: boolean;
  /** Tiempo de vida en milisegundos (7 días por defecto). */
  maxAgeMs: number;
}

/**
 * Cookie del refresh token: HttpOnly (inaccesible desde JS → anti-XSS),
 * SameSite=Strict (anti-CSRF) y path acotado a /api/auth para que el
 * navegador solo la envíe a los endpoints de autenticación.
 */
export function setRefreshCookie(
  res: Response,
  token: string,
  security: CookieSecurity
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: security.secure,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: security.maxAgeMs
  });
}

/** Borra la cookie. El `path` debe coincidir con el usado al crearla. */
export function clearRefreshCookie(res: Response, secure: boolean): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api/auth'
  });
}
