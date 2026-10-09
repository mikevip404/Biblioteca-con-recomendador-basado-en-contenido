import { Router } from 'express';
/** Rutas de health. El router recibe el controlador por inyección. */
export function createHealthRouter(controller) {
    const router = Router();
    router.get('/health', controller.getHealth);
    return router;
}
