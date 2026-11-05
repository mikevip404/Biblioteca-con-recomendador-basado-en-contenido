import { Router } from 'express';
import { RecommenderController } from '../controllers/recommender.controller.js';
import { authenticate } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { idParamSchema } from '../schemas/catalog.schemas.js';
import {
  rebuildJobParamSchema,
  recommenderQuerySchema
} from '../schemas/recommender.schemas.js';
import type { TokenService } from '../services/token.service.js';

export interface RecommenderRouterDeps {
  controller: RecommenderController;
  tokenService: TokenService;
}

/**
 * Recomendador: consultas para autenticados y reconstrucción de vectores
 * reservada a `admin`.
 */
export function createRecommenderRouter(deps: RecommenderRouterDeps): Router {
  const router = Router();
  const requireAuth = authenticate(deps.tokenService);
  const requireAdmin = authorize('admin');

  router.get(
    '/api/me/recommendations',
    requireAuth,
    validate({ query: recommenderQuerySchema }),
    deps.controller.recommendations
  );
  router.get(
    '/api/books/:id/similar',
    requireAuth,
    validate({ params: idParamSchema, query: recommenderQuerySchema }),
    deps.controller.similar
  );
  router.get(
    '/api/books/:id/graph',
    requireAuth,
    validate({ params: idParamSchema, query: recommenderQuerySchema }),
    deps.controller.graph
  );
  router.get(
    '/api/admin/recommender/status',
    requireAuth,
    requireAdmin,
    deps.controller.status
  );
  router.post(
    '/api/admin/recommender/rebuild',
    requireAuth,
    requireAdmin,
    deps.controller.rebuild
  );
  router.get(
    '/api/admin/recommender/rebuild/:jobId',
    requireAuth,
    requireAdmin,
    validate({ params: rebuildJobParamSchema }),
    deps.controller.rebuildStatus
  );

  return router;
}
