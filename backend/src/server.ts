import 'dotenv/config';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { connectMongo } from './db/mongo.js';
import { runMigrations } from './db/migrate.js';
import { HealthController } from './controllers/health.controller.js';
import { HealthService } from './services/health.service.js';
import { MongoHealthRepository } from './repositories/health.repository.js';
import { createLogger } from './utils/logger.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger('biblioteca-api', env.LOG_LEVEL);

  const db = await connectMongo(env.MONGODB_URI, env.MONGODB_DB_NAME);

  if (env.AUTO_MIGRATE) {
    const applied = await runMigrations(db);
    logger.info('migraciones verificadas', { applied });
  }

  // Cableado de dependencias (composición raíz).
  const healthRepository = new MongoHealthRepository(db);
  const healthService = new HealthService(healthRepository);
  const healthController = new HealthController(healthService);

  const app = createApp(
    { healthController },
    { logger }
  );

  const server = app.listen(env.PORT, () => {
    logger.info('servidor iniciado', { port: env.PORT });
  });

  const shutdown = (signal: string) => async () => {
    logger.info('cerrando servidor', { signal });
    server.close();
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    service: 'biblioteca-api',
    message: `Fallo al arrancar: ${message}`
  }));
  process.exit(1);
});
