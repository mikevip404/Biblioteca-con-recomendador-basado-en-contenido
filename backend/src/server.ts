import 'dotenv/config';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import {
  connectMongo
} from './db/mongo.js';
import { runMigrations } from './db/migrate.js';
import { AuthController } from './controllers/auth.controller.js';
import { AuthorController } from './controllers/author.controller.js';
import { BookController } from './controllers/book.controller.js';
import { GenreController } from './controllers/genre.controller.js';
import { HealthController } from './controllers/health.controller.js';
import { createRateLimiter } from './middlewares/rateLimit.middleware.js';
import { MongoAuthorRepository } from './repositories/author.repository.js';
import { MongoBookRelationsRepository } from './repositories/book-relations.repository.js';
import { MongoBookRepository } from './repositories/book.repository.js';
import { MongoGenreRepository } from './repositories/genre.repository.js';
import { MongoRefreshTokenRepository } from './repositories/refresh-token.repository.js';
import { MongoUserRepository } from './repositories/user.repository.js';
import { MongoHealthRepository } from './repositories/health.repository.js';
import { AuthService } from './services/auth.service.js';
import { AuthorService } from './services/author.service.js';
import { BookService } from './services/book.service.js';
import { GenreService } from './services/genre.service.js';
import { HealthService } from './services/health.service.js';
import { Argon2PasswordService } from './services/password.service.js';
import { JwtTokenService } from './services/token.service.js';
import { createLogger } from './utils/logger.js';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger('biblioteca-api', env.LOG_LEVEL);

  const db = await connectMongo(env.MONGODB_URI, env.MONGODB_DB_NAME);

  if (env.AUTO_MIGRATE) {
    const applied = await runMigrations(db);
    logger.info('migraciones verificadas', { applied });
  }

  // Cableado de dependencias (composición raíz).
  const passwordService = new Argon2PasswordService();
  const tokenService = new JwtTokenService({
    secret: env.JWT_SECRET,
    accessTokenTtlSec: env.ACCESS_TOKEN_TTL_SEC
  });
  const userRepository = new MongoUserRepository(db);
  const refreshTokenRepository = new MongoRefreshTokenRepository(db);
  const authService = new AuthService(
    userRepository,
    refreshTokenRepository,
    passwordService,
    tokenService,
    {
      accessTokenTtlSec: env.ACCESS_TOKEN_TTL_SEC,
      refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      maxSessions: env.MAX_SESSIONS_PER_USER,
      maxLoginAttempts: env.LOGIN_MAX_ATTEMPTS,
      lockMinutes: env.LOGIN_LOCK_MINUTES
    }
  );
  const authController = new AuthController(authService, {
    secure: env.NODE_ENV === 'production',
    refreshMaxAgeMs: env.REFRESH_TOKEN_TTL_DAYS * MS_PER_DAY
  });

  // Catálogo (Fase 3): autores, géneros y libros.
  const authorRepository = new MongoAuthorRepository(db);
  const genreRepository = new MongoGenreRepository(db);
  const bookRepository = new MongoBookRepository(db);
  const bookRelationsRepository = new MongoBookRelationsRepository(db);

  const rateWindowMs = env.AUTH_RATE_LIMIT_WINDOW_MIN * MS_PER_MINUTE;
  const app = createApp(
    {
      healthController: new HealthController(new HealthService(new MongoHealthRepository(db))),
      authController,
      authorController: new AuthorController(
        new AuthorService(authorRepository, bookRepository)
      ),
      genreController: new GenreController(
        new GenreService(genreRepository, bookRepository)
      ),
      bookController: new BookController(
        new BookService(
          bookRepository,
          authorRepository,
          genreRepository,
          bookRelationsRepository
        )
      ),
      tokenService,
      registerLimiter: createRateLimiter({ windowMs: rateWindowMs, max: env.AUTH_RATE_LIMIT_MAX }),
      loginLimiter: createRateLimiter({ windowMs: rateWindowMs, max: env.AUTH_RATE_LIMIT_MAX }),
      refreshLimiter: createRateLimiter({ windowMs: rateWindowMs, max: env.AUTH_RATE_LIMIT_MAX })
    },
    { logger, corsOrigins: env.CORS_ORIGINS }
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
