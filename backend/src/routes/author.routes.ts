import { Router } from 'express';
import { AuthorController } from '../controllers/author.controller.js';
import { authenticate } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createAuthorSchema,
  idParamSchema,
  updateAuthorSchema
} from '../schemas/catalog.schemas.js';
import type { TokenService } from '../services/token.service.js';

export interface AuthorRouterDeps {
  controller: AuthorController;
  tokenService: TokenService;
}

/** Autores: lectura para autenticados; escritura solo `admin`. */
export function createAuthorRouter(deps: AuthorRouterDeps): Router {
  const router = Router();
  const requireAuth = authenticate(deps.tokenService);
  const requireAdmin = authorize('admin');

  router.get('/api/authors', requireAuth, deps.controller.list);
  router.get(
    '/api/authors/:id',
    requireAuth,
    validate({ params: idParamSchema }),
    deps.controller.getById
  );
  router.post(
    '/api/authors',
    requireAuth,
    requireAdmin,
    validate({ body: createAuthorSchema }),
    deps.controller.create
  );
  router.patch(
    '/api/authors/:id',
    requireAuth,
    requireAdmin,
    validate({ params: idParamSchema, body: updateAuthorSchema }),
    deps.controller.update
  );
  router.delete(
    '/api/authors/:id',
    requireAuth,
    requireAdmin,
    validate({ params: idParamSchema }),
    deps.controller.remove
  );

  return router;
}
