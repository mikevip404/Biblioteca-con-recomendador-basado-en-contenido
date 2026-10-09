import { HttpError } from './error.middleware.js';
/**
 * Restringe por rol. Debe usarse DESPUÉS de `authenticate`.
 * Ejemplo: `router.get('/admin', authenticate(ts), authorize('admin'), ...)`.
 */
export function authorize(...allowed) {
    return (req, _res, next) => {
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
