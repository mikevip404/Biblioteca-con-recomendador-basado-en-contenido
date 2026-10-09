import { Router } from 'express';
import { HealthController } from '../controllers/health.controller.js';

/** Rutas de health. El router recibe el controlador por inyección. */
export function createHealthRouter(controller: HealthController): Router {
  const router = Router();
  router.get('/health', controller.getHealth);
  return router;
}
