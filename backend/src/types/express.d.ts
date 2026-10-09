import 'express';
import type { AuthUser } from './auth.js';

declare module 'express' {
  interface Request {
    /** Identificador de correlación de la petición (x-correlation-id). */
    correlationId?: string;
    /** Usuario autenticado (lo fija el middleware `authenticate`). */
    user?: AuthUser;
  }
}
