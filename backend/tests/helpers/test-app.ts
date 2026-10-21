import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import type { MongoDatabase } from '../../src/db/mongo.js';
import { AuthController } from '../../src/controllers/auth.controller.js';
import { AuthorController } from '../../src/controllers/author.controller.js';
import { BookController } from '../../src/controllers/book.controller.js';
import { FavoriteController } from '../../src/controllers/favorite.controller.js';
import { GenreController } from '../../src/controllers/genre.controller.js';
import { HealthController } from '../../src/controllers/health.controller.js';
import { RatingController } from '../../src/controllers/rating.controller.js';
import { createRateLimiter } from '../../src/middlewares/rateLimit.middleware.js';
import { MongoAuthorRepository } from '../../src/repositories/author.repository.js';
import { MongoBookRelationsRepository } from '../../src/repositories/book-relations.repository.js';
import { MongoBookRepository } from '../../src/repositories/book.repository.js';
import { MongoFavoriteRepository } from '../../src/repositories/favorite.repository.js';
import { MongoGenreRepository } from '../../src/repositories/genre.repository.js';
import { MongoRatingRepository } from '../../src/repositories/rating.repository.js';
import type { HealthRepository } from '../../src/repositories/health.repository.js';
import { MongoHealthRepository } from '../../src/repositories/health.repository.js';
import { MongoRefreshTokenRepository } from '../../src/repositories/refresh-token.repository.js';
import { MongoUserRepository } from '../../src/repositories/user.repository.js';
import { AuthService } from '../../src/services/auth.service.js';
import { AuthorService } from '../../src/services/author.service.js';
import { BookService } from '../../src/services/book.service.js';
import { FavoriteService } from '../../src/services/favorite.service.js';
import { GenreService } from '../../src/services/genre.service.js';
import { HealthService } from '../../src/services/health.service.js';
import { RatingService } from '../../src/services/rating.service.js';
import { Argon2PasswordService } from '../../src/services/password.service.js';
import type { TokenService } from '../../src/services/token.service.js';
import { createLogger } from '../../src/utils/logger.js';

/** Composición raíz equivalente a `server.ts`, para las pruebas. */
export function buildTestApp(
  db: MongoDatabase,
  tokenService: TokenService,
  options: { healthRepository?: HealthRepository } = {}
): Express {
  const authService = new AuthService(
    new MongoUserRepository(db),
    new MongoRefreshTokenRepository(db),
    new Argon2PasswordService(),
    tokenService,
    {
      accessTokenTtlSec: 900,
      refreshTokenTtlDays: 7,
      maxSessions: 5,
      maxLoginAttempts: 5,
      lockMinutes: 15
    }
  );

  const userRepository = new MongoUserRepository(db);
  const authorRepository = new MongoAuthorRepository(db);
  const genreRepository = new MongoGenreRepository(db);
  const bookRepository = new MongoBookRepository(db);
  const bookRelationsRepository = new MongoBookRelationsRepository(db);
  const ratingRepository = new MongoRatingRepository(db);
  const favoriteRepository = new MongoFavoriteRepository(db);

  const ratingService = new RatingService(
    db,
    ratingRepository,
    bookRepository,
    userRepository
  );
  const favoriteService = new FavoriteService(favoriteRepository, bookRepository);

  const generous = createRateLimiter({ windowMs: 60_000, max: 1_000_000 });
  return createApp(
    {
      healthController: new HealthController(
        new HealthService(options.healthRepository ?? new MongoHealthRepository(db))
      ),
      authController: new AuthController(authService, {
        secure: false,
        refreshMaxAgeMs: 7 * 86_400_000
      }),
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
          bookRelationsRepository,
          ratingRepository,
          favoriteRepository
        )
      ),
      ratingController: new RatingController(ratingService),
      favoriteController: new FavoriteController(favoriteService),
      resolveRatingOwnerId: (ratingId: string) => ratingService.findOwnerId(ratingId),
      tokenService,
      registerLimiter: generous,
      loginLimiter: generous,
      refreshLimiter: generous,
      writeLimiter: generous
    },
    { logger: createLogger('test', 'error'), corsOrigins: [] }
  );
}
