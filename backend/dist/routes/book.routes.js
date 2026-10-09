import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { bookQuerySchema, createBookSchema, idParamSchema, updateBookSchema } from '../schemas/catalog.schemas.js';
/** Libros: lectura para autenticados; escritura solo `admin`. */
export function createBookRouter(deps) {
    const router = Router();
    const requireAuth = authenticate(deps.tokenService);
    const requireAdmin = authorize('admin');
    router.get('/api/books', requireAuth, validate({ query: bookQuerySchema }), deps.controller.list);
    router.get('/api/books/:id', requireAuth, validate({ params: idParamSchema }), deps.controller.getById);
    router.post('/api/books', requireAuth, requireAdmin, validate({ body: createBookSchema }), deps.controller.create);
    router.patch('/api/books/:id', requireAuth, requireAdmin, validate({ params: idParamSchema, body: updateBookSchema }), deps.controller.update);
    router.delete('/api/books/:id', requireAuth, requireAdmin, validate({ params: idParamSchema }), deps.controller.remove);
    return router;
}
