import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

const SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres!!';

const base = {
  MONGODB_URI: 'mongodb://localhost:27017',
  JWT_SECRET: SECRET
};

describe('parseEnv', () => {
  it('aplica valores por defecto cuando solo hay lo obligatorio', () => {
    const env = parseEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.MONGODB_DB_NAME).toBe('biblioteca');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.AUTO_MIGRATE).toBe(true);
    expect(env.ACCESS_TOKEN_TTL_SEC).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.AUTH_RATE_LIMIT_MAX).toBe(10);
    expect(env.AUTH_RATE_LIMIT_WINDOW_MIN).toBe(15);
    expect(env.MAX_SESSIONS_PER_USER).toBe(5);
    expect(env.LOGIN_MAX_ATTEMPTS).toBe(5);
    expect(env.LOGIN_LOCK_MINUTES).toBe(15);
    expect(env.ADMIN_EMAIL).toBeUndefined();
  });

  it('parsea el puerto, el nivel de log y los orígenes CORS', () => {
    const env = parseEnv({
      ...base,
      PORT: '8080',
      LOG_LEVEL: 'debug',
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://app.ejemplo.com, https://admin.ejemplo.com'
    });
    expect(env.PORT).toBe(8080);
    expect(env.LOG_LEVEL).toBe('debug');
    expect(env.NODE_ENV).toBe('production');
    expect(env.CORS_ORIGINS).toEqual([
      'https://app.ejemplo.com',
      'https://admin.ejemplo.com'
    ]);
  });

  it('acepta URIs mongodb:// y mongodb+srv:// (Atlas)', () => {
    expect(
      parseEnv({ ...base, MONGODB_URI: 'mongodb+srv://user:pass@cluster0.ejemplo.mongodb.net' })
        .MONGODB_URI
    ).toContain('mongodb+srv://');
  });

  it('convierte AUTO_MIGRATE a booleano', () => {
    expect(parseEnv({ ...base, AUTO_MIGRATE: 'false' }).AUTO_MIGRATE).toBe(false);
  });

  it('rechaza un puerto fuera de rango', () => {
    expect(() => parseEnv({ ...base, PORT: '99999' })).toThrow();
    expect(() => parseEnv({ ...base, PORT: 'cero' })).toThrow();
  });

  it('rechaza MONGODB_URI vacía, ausente o no mongo', () => {
    expect(() => parseEnv({ JWT_SECRET: SECRET })).toThrow();
    expect(() => parseEnv({ ...base, MONGODB_URI: '' })).toThrow();
    expect(() => parseEnv({ ...base, MONGODB_URI: 'mysql://user@host/db' })).toThrow();
    expect(() => parseEnv({ ...base, MONGODB_URI: 'postgresql://user@host/db' })).toThrow();
  });

  it('exige JWT_SECRET de al menos 32 caracteres (si no, no arranca)', () => {
    expect(() => parseEnv({ MONGODB_URI: base.MONGODB_URI })).toThrow();
    expect(() => parseEnv({ ...base, JWT_SECRET: 'corto' })).toThrow();
  });
});
