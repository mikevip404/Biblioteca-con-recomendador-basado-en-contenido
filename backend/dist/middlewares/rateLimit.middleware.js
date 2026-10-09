import { rateLimit } from 'express-rate-limit';
/**
 * Rate limiting por IP para endpoints sensibles (login, register, refresh).
 * Responde 429 con el formato uniforme de errores de la API.
 */
export function createRateLimiter(options) {
    return rateLimit({
        windowMs: options.windowMs,
        max: options.max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                error: {
                    code: 'RATE_LIMITED',
                    message: 'Demasiadas solicitudes, intenta más tarde',
                    correlationId: req.correlationId
                }
            });
        }
    });
}
