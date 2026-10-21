import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { authenticate } from '../../src/middlewares/authenticate.middleware.js';
import { authorize } from '../../src/middlewares/authorize.middleware.js';
import { requireOwnership } from '../../src/middlewares/ownership.middleware.js';
import { createRateLimiter } from '../../src/middlewares/rateLimit.middleware.js';
import { validate } from '../../src/middlewares/validate.middleware.js';
import { errorMiddleware } from '../../src/middlewares/error.middleware.js';
import { z } from 'zod';
import { createLogger } from '../../src/utils/logger.js';
import { JwtTokenService } from '../../src/services/token.service.js';
import type { AuthUser } from '../../src/types/auth.js';

const SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres!!';
const tokenService = new JwtTokenService({ secret: SECRET, accessTokenTtlSec: 900 });

function sign(user: AuthUser): string {
  return tokenService.signAccessToken({ sub: user.id, role: user.role });
}

/** Mini-app con manejo de errores para probar middlewares aislados. */
function buildProbe(...handlers: express.RequestHandler[]): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/probe', ...handlers, (_req: express.Request, res: express.Response) => {
    res.status(200).json({ user: _req.user ?? null, body: _req.body ?? null });
  });
  app.use(errorMiddleware(createLogger('test', 'error')));
  return app;
}

describe('authenticate', () => {
  it('adjunta el usuario con un Bearer válido', async () => {
    const token = sign({ id: 'u1', role: 'lector' });
    const res = await request(buildProbe(authenticate(tokenService)))
      .get('/probe')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'u1', role: 'lector' });
  });

  it('responde 401 sin header, con esquema distinto o token inválido', async () => {
    const app = buildProbe(authenticate(tokenService));

    expect((await request(app).get('/probe')).status).toBe(401);
    expect(
      (await request(app).get('/probe').set('Authorization', 'Basic abc')).status
    ).toBe(401);
    expect(
      (await request(app).get('/probe').set('Authorization', 'Bearer roto')).status
    ).toBe(401);
  });
});

describe('authorize', () => {
  it('permite el rol autorizado y niega con 403 el resto', async () => {
    const adminOnly = buildProbe(
      authenticate(tokenService),
      authorize('admin')
    );
    const adminToken = sign({ id: 'a1', role: 'admin' });
    const lectorToken = sign({ id: 'l1', role: 'lector' });

    expect(
      (await request(adminOnly).get('/probe').set('Authorization', `Bearer ${adminToken}`)).status
    ).toBe(200);
    const denied = await request(adminOnly)
      .get('/probe')
      .set('Authorization', `Bearer ${lectorToken}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });

  it('responde 401 si no hay usuario autenticado', async () => {
    const res = await request(buildProbe(authorize('admin'))).get('/probe');
    expect(res.status).toBe(401);
  });
});

describe('requireOwnership', () => {
  const byParam = (req: express.Request): string | undefined =>
    typeof req.query['ownerId'] === 'string' ? req.query['ownerId'] : undefined;

  it('permite al dueño y niega con 403 a terceros', async () => {
    const app = buildProbe(authenticate(tokenService), requireOwnership(byParam));
    const token = sign({ id: 'u1', role: 'lector' });

    expect(
      (await request(app).get('/probe?ownerId=u1').set('Authorization', `Bearer ${token}`)).status
    ).toBe(200);
    expect(
      (await request(app).get('/probe?ownerId=u2').set('Authorization', `Bearer ${token}`)).status
    ).toBe(403);
  });

  it('exime al admin aunque no sea el dueño', async () => {
    const app = buildProbe(authenticate(tokenService), requireOwnership(byParam));
    const token = sign({ id: 'admin1', role: 'admin' });

    expect(
      (await request(app).get('/probe?ownerId=otro').set('Authorization', `Bearer ${token}`)).status
    ).toBe(200);
  });

  it('soporta resolutores asíncronos y reenvía sus errores', async () => {
    const failing = buildProbe(
      authenticate(tokenService),
      requireOwnership(() => Promise.reject(new Error('fallo en BD')))
    );
    const token = sign({ id: 'u1', role: 'lector' });

    const res = await request(failing)
      .get('/probe')
      .set('Authorization', `Bearer ${token}`);
    // Error no controlado: 500 genérico sin filtrar detalles.
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('validate', () => {
  const schema = z.object({ email: z.string().email() });

  it('deja pasar el body válido sin claves desconocidas', async () => {
    const app = express();
    app.use(express.json());
    app.post('/probe', validate({ body: schema }), (req, res) => {
      res.status(200).json({ body: req.body });
    });
    app.use(errorMiddleware(createLogger('test', 'error')));

    const res = await request(app)
      .post('/probe')
      .send({ email: 'a@b.co', role: 'admin' });

    expect(res.status).toBe(200);
    // `role` fue eliminado por Zod: no hay escalamiento de privilegios.
    expect(res.body.body).toEqual({ email: 'a@b.co' });
  });

  it('responde 400 con detalle por campo ante body inválido', async () => {
    const app = express();
    app.use(express.json());
    app.post('/probe', validate({ body: schema }), (_req, res) => {
      res.status(200).json({});
    });
    app.use(errorMiddleware(createLogger('test', 'error')));

    const res = await request(app).post('/probe').send({ email: 'no-es-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('createRateLimiter', () => {
  it('responde 429 con formato uniforme al exceder el máximo', async () => {
    const app = express();
    app.get(
      '/probe',
      createRateLimiter({ windowMs: 60_000, max: 2 }),
      (_req, res) => {
        res.status(200).json({});
      }
    );

    expect((await request(app).get('/probe')).status).toBe(200);
    expect((await request(app).get('/probe')).status).toBe(200);
    const limited = await request(app).get('/probe');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
