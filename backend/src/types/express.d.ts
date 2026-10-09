import 'express';

declare module 'express' {
  interface Request {
    /** Identificador de correlación de la petición (x-correlation-id). */
    correlationId?: string;
  }
}
