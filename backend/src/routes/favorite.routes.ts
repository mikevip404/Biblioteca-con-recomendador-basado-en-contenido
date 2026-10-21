import { Router, type RequestHandler } from 'express';
import { FavoriteController } from '../controllers/favorite.controller.js';
import { authenticate } from '../middlewares/authenticate.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { bookIdParamSchema, ratingsQuerySchema } from '../schemas/ratings.schemas.js';
import type { TokenService } from '../services/token.service.js';

export interface FavoriteRouterDeps {
  controller: FavoriteController;
  tokenService: TokenService;
  writeLimiter: RequestHandler;
}

/** Favoritos: todas requieren autenticación; alta/baja con rate limit. */
export function createFavoriteRouter(deps: FavoriteRouterDeps): Router {
  const router = Router();
  const requireAuth = authenticate(deps.tokenService);

  router.put(
    '/api/books/:bookId/favorite',
    requireAuth,
    deps.writeLimiter,
    validate({ params: bookIdParamSchema }),
    deps.controller.add
  );
  router.delete(
    '/api/books/:bookId/favorite',
    requireAuth,
    deps.writeLimiter,
    validate({ params: bookIdParamSchema }),
    deps.controller.remove
  );
  router.get(
    '/api/me/favorites',
    requireAuth,
    validate({ query: ratingsQuerySchema }),
    deps.controller.listMine
  );

  return router;
}
