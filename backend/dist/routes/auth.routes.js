import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { loginSchema, registerSchema } from '../schemas/auth.schemas.js';
/**
 * Rutas de autenticación. Login/register/refresh llevan rate limiting
 * estricto por IP; logout-all y me exigen access token.
 */
export function createAuthRouter(deps) {
    const router = Router();
    const requireAuth = authenticate(deps.tokenService);
    router.post('/api/auth/register', deps.registerLimiter, validate({ body: registerSchema }), deps.controller.register);
    router.post('/api/auth/login', deps.loginLimiter, validate({ body: loginSchema }), deps.controller.login);
    router.post('/api/auth/refresh', deps.refreshLimiter, deps.controller.refresh);
    router.post('/api/auth/logout', deps.controller.logout);
    router.post('/api/auth/logout-all', requireAuth, deps.controller.logoutAll);
    router.get('/api/auth/me', requireAuth, deps.controller.me);
    return router;
}
