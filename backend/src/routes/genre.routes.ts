import { Router } from 'express';
import { GenreController } from '../controllers/genre.controller.js';
import { authenticate } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createGenreSchema,
  idParamSchema,
  updateGenreSchema
} from '../schemas/catalog.schemas.js';
import type { TokenService } from '../services/token.service.js';

export interface GenreRouterDeps {
  controller: GenreController;
  tokenService: TokenService;
}

/** Géneros: lectura para autenticados; escritura solo `admin`. */
export function createGenreRouter(deps: GenreRouterDeps): Router {
  const router = Router();
  const requireAuth = authenticate(deps.tokenService);
  const requireAdmin = authorize('admin');

  router.get('/api/genres', requireAuth, deps.controller.list);
  router.get(
    '/api/genres/:id',
    requireAuth,
    validate({ params: idParamSchema }),
    deps.controller.getById
  );
  router.post(
    '/api/genres',
    requireAuth,
    requireAdmin,
    validate({ body: createGenreSchema }),
    deps.controller.create
  );
  router.patch(
    '/api/genres/:id',
    requireAuth,
    requireAdmin,
    validate({ params: idParamSchema, body: updateGenreSchema }),
    deps.controller.update
  );
  router.delete(
    '/api/genres/:id',
    requireAuth,
    requireAdmin,
    validate({ params: idParamSchema }),
    deps.controller.remove
  );

  return router;
}
