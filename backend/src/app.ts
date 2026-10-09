import express from 'express';
import type { Express } from 'express';
import type { HealthController } from './controllers/health.controller.js';
import { correlationIdMiddleware } from './middlewares/correlationId.middleware.js';
import {
  errorMiddleware,
  notFoundMiddleware
} from './middlewares/error.middleware.js';
import { requestLoggerMiddleware } from './middlewares/requestLogger.middleware.js';
import { createHealthRouter } from './routes/health.routes.js';
import type { Logger } from './utils/logger.js';

/**
 * Dependencias de la aplicación. El servidor (o los tests) inyecta
 * implementaciones concretas; la app solo conoce interfaces.
 */
export interface AppDependencies {
  healthController: HealthController;
}

export interface AppOptions {
  logger: Logger;
}

/** Factoría de la app Express con los middlewares globales. */
export function createApp(
  deps: AppDependencies,
  options: AppOptions
): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware(options.logger));

  app.use(createHealthRouter(deps.healthController));

  app.use(notFoundMiddleware);
  app.use(errorMiddleware(options.logger));

  return app;
}
