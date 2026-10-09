import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import { correlationIdMiddleware } from './middlewares/correlationId.middleware.js';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware.js';
import { requestLoggerMiddleware } from './middlewares/requestLogger.middleware.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createAuthorRouter } from './routes/author.routes.js';
import { createBookRouter } from './routes/book.routes.js';
import { createGenreRouter } from './routes/genre.routes.js';
import { createHealthRouter } from './routes/health.routes.js';
/** Factoría de la app Express con los middlewares globales. */
export function createApp(deps, options) {
    const app = express();
    app.disable('x-powered-by');
    // Trazabilidad primero: todo lo demás ya ve el correlation-id.
    app.use(correlationIdMiddleware);
    // Cabeceras de seguridad (CSP, HSTS, anti-clickjacking, etc.).
    app.use(helmet());
    // CORS con credenciales para los orígenes permitidos (el futuro frontend).
    app.use(cors({ origin: options.corsOrigins, credentials: true }));
    app.use(express.json({ limit: '100kb' }));
    app.use(cookieParser());
    // Sanitización anti-inyección NoSQL: elimina claves `$` y `.` del
    // body/query/params antes de que lleguen a los controladores.
    app.use(mongoSanitize());
    app.use(requestLoggerMiddleware(options.logger));
    app.use(createHealthRouter(deps.healthController));
    app.use(createAuthRouter({
        controller: deps.authController,
        tokenService: deps.tokenService,
        registerLimiter: deps.registerLimiter,
        loginLimiter: deps.loginLimiter,
        refreshLimiter: deps.refreshLimiter
    }));
    app.use(createAuthorRouter({
        controller: deps.authorController,
        tokenService: deps.tokenService
    }));
    app.use(createGenreRouter({
        controller: deps.genreController,
        tokenService: deps.tokenService
    }));
    app.use(createBookRouter({
        controller: deps.bookController,
        tokenService: deps.tokenService
    }));
    app.use(notFoundMiddleware);
    app.use(errorMiddleware(options.logger));
    return app;
}
