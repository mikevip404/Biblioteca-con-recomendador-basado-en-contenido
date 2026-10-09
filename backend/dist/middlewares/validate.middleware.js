import { z } from 'zod';
import { HttpError } from './error.middleware.js';
/**
 * Valida body, params y query con Zod y REEMPLAZA los valores por los
 * parseados (normalizados y sin claves desconocidas). Los errores viajan
 * como 400 con el detalle por campo, nunca como 500.
 */
export function validate(schemas) {
    return (req, _res, next) => {
        try {
            if (schemas.body !== undefined) {
                req.body = schemas.body.parse(req.body);
            }
            if (schemas.params !== undefined) {
                req.params = schemas.params.parse(req.params);
            }
            if (schemas.query !== undefined) {
                req.query = schemas.query.parse(req.query);
            }
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                next(HttpError.badRequest('Datos de entrada inválidos', error.flatten().fieldErrors));
                return;
            }
            next(error);
            return;
        }
        next();
    };
}
