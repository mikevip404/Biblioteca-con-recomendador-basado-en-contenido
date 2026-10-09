/**
 * Error con status y código de negocio. Todo error controlado de la API
 * debería ser un HttpError; cualquier otro se responde como 500 genérico
 * (sin filtrar detalles internos al cliente).
 */
export class HttpError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = 'HttpError';
    }
    static badRequest(message, details) {
        return new HttpError(400, 'BAD_REQUEST', message, details);
    }
    static unauthorized(message = 'No autenticado') {
        return new HttpError(401, 'UNAUTHORIZED', message);
    }
    static forbidden(message = 'Acceso denegado') {
        return new HttpError(403, 'FORBIDDEN', message);
    }
    static conflict(message, details) {
        return new HttpError(409, 'CONFLICT', message, details);
    }
    static locked(message = 'Recurso bloqueado temporalmente') {
        return new HttpError(423, 'LOCKED', message);
    }
    /** Login fallido: mensaje genérico anti-enumeración. */
    static invalidCredentials() {
        return new HttpError(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas');
    }
    static invalidRefreshToken(message = 'Sesión inválida o expirada') {
        return new HttpError(401, 'INVALID_REFRESH_TOKEN', message);
    }
    /** Un token ya rotado volvió a usarse: la familia completa fue revocada. */
    static sessionReused() {
        return new HttpError(401, 'SESSION_REUSED', 'Sesión reutilizada: todas tus sesiones fueron revocadas por seguridad');
    }
    static notFound(message = 'Recurso no encontrado') {
        return new HttpError(404, 'NOT_FOUND', message);
    }
    static internal(message = 'Error interno del servidor') {
        return new HttpError(500, 'INTERNAL_ERROR', message);
    }
}
/** Convierte rutas no encontradas en un HttpError 404. */
export function notFoundMiddleware(req, _res, next) {
    next(HttpError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}
/** Manejador global de errores: log estructurado + respuesta JSON uniforme. */
export function errorMiddleware(logger) {
    return (err, req, res, _next) => {
        const correlationId = req.correlationId;
        if (err instanceof HttpError) {
            logger.warn(err.message, {
                correlationId,
                status: err.status,
                code: err.code
            });
            res.status(err.status).json({
                error: { code: err.code, message: err.message, correlationId }
            });
            return;
        }
        const message = err instanceof Error ? err.message : 'Error desconocido';
        logger.error(message, {
            correlationId,
            stack: err instanceof Error ? err.stack : undefined
        });
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor', correlationId }
        });
    };
}
