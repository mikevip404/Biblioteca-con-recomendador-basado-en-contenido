import { HttpError } from './error.middleware.js';
/**
 * Valida que el recurso pertenece al usuario autenticado. Debe usarse
 * DESPUÉS de `authenticate`. Los `admin` están exentos (pueden gestionar
 * recursos ajenos); los `lector` solo operan sobre lo propio.
 */
export function requireOwnership(resolveOwnerId) {
    return async (req, _res, next) => {
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
        }
        catch (error) {
            // Express 4 no captura rechazos en middlewares async: se reenvían a mano.
            next(error);
        }
    };
}
