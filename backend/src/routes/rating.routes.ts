import { Router, type Request, type RequestHandler } from 'express';
import { RatingController } from '../controllers/rating.controller.js';
import { authenticate } from '../middlewares/authenticate.middleware.js';
import { requireOwnership } from '../middlewares/ownership.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  bookIdParamSchema,
  ratingBodySchema,
  ratingIdParamSchema,
  ratingsQuerySchema
} from '../schemas/ratings.schemas.js';
import type { TokenService } from '../services/token.service.js';

export interface RatingRouterDeps {
  controller: RatingController;
  tokenService: TokenService;
  writeLimiter: RequestHandler;
  /** Resolutor de dueño de una valoración para `requireOwnership`. */
  resolveOwnerId: (ratingId: string) => Promise<string | undefined>;
}

/** Valoraciones: todas requieren autenticación; escritura con rate limit. */
export function createRatingRouter(deps: RatingRouterDeps): Router {
  const router = Router();
  const requireAuth = authenticate(deps.tokenService);

  router.put(
    '/api/books/:bookId/rating',
    requireAuth,
    deps.writeLimiter,
    validate({ params: bookIdParamSchema, body: ratingBodySchema }),
    deps.controller.putMine
  );
  router.delete(
    '/api/books/:bookId/rating',
    requireAuth,
    deps.writeLimiter,
    validate({ params: bookIdParamSchema }),
    deps.controller.deleteMine
  );
  router.get(
    '/api/books/:bookId/ratings',
    requireAuth,
    validate({ params: bookIdParamSchema, query: ratingsQuerySchema }),
    deps.controller.listByBook
  );
  router.get(
    '/api/me/ratings',
    requireAuth,
    validate({ query: ratingsQuerySchema }),
    deps.controller.listMine
  );
  router.delete(
    '/api/ratings/:id',
    requireAuth,
    deps.writeLimiter,
    validate({ params: ratingIdParamSchema }),
    requireOwnership(
      (req: Request): Promise<string | undefined> =>
        deps.resolveOwnerId((req.params as { id: string }).id)
    ),
    deps.controller.deleteById
  );

  return router;
}
