import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import type { Express } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import type { AuthController } from './controllers/auth.controller.js';
import type { AuthorController } from './controllers/author.controller.js';
import type { BookController } from './controllers/book.controller.js';
import type { GenreController } from './controllers/genre.controller.js';
import type { HealthController } from './controllers/health.controller.js';
import { correlationIdMiddleware } from './middlewares/correlationId.middleware.js';
import {
  errorMiddleware,
  notFoundMiddleware
} from './middlewares/error.middleware.js';
import { requestLoggerMiddleware } from './middlewares/requestLogger.middleware.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createAuthorRouter } from './routes/author.routes.js';
import { createBookRouter } from './routes/book.routes.js';
import { createGenreRouter } from './routes/genre.routes.js';
import { createHealthRouter } from './routes/health.routes.js';
import type { TokenService } from './services/token.service.js';
import type { Logger } from './utils/logger.js';

/**
 * Dependencias de la aplicación. El servidor (o los tests) inyecta
 * implementaciones concretas; la app solo conoce interfaces y handlers.
 */
export interface AppDependencies {
  healthController: HealthController;
  authController: AuthController;
  authorController: AuthorController;
  genreController: GenreController;
  bookController: BookController;
  tokenService: TokenService;
  registerLimiter: RequestHandler;
  loginLimiter: RequestHandler;
  refreshLimiter: RequestHandler;
}

export interface AppOptions {
  logger: Logger;
  corsOrigins: string[];
}

/** Factoría de la app Express con los middlewares globales. */
export function createApp(
  deps: AppDependencies,
  options: AppOptions
): Express {
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
  app.use(
    createAuthRouter({
      controller: deps.authController,
      tokenService: deps.tokenService,
      registerLimiter: deps.registerLimiter,
      loginLimiter: deps.loginLimiter,
      refreshLimiter: deps.refreshLimiter
    })
  );
  app.use(
    createAuthorRouter({
      controller: deps.authorController,
      tokenService: deps.tokenService
    })
  );
  app.use(
    createGenreRouter({
      controller: deps.genreController,
      tokenService: deps.tokenService
    })
  );
  app.use(
    createBookRouter({
      controller: deps.bookController,
      tokenService: deps.tokenService
    })
  );

  app.use(notFoundMiddleware);
  app.use(errorMiddleware(options.logger));

  return app;
}
