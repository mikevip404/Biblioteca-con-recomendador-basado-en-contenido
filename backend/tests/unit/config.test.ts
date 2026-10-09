import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

const base = {
  MONGODB_URI: 'mongodb://localhost:27017'
};

describe('parseEnv', () => {
  it('aplica valores por defecto cuando solo hay MONGODB_URI', () => {
    const env = parseEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.MONGODB_DB_NAME).toBe('biblioteca');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.AUTO_MIGRATE).toBe(true);
  });

  it('parsea el puerto, el nivel de log y el nombre de la BD', () => {
    const env = parseEnv({
      ...base,
      PORT: '8080',
      LOG_LEVEL: 'debug',
      NODE_ENV: 'production',
      MONGODB_DB_NAME: 'biblio_test'
    });
    expect(env.PORT).toBe(8080);
    expect(env.LOG_LEVEL).toBe('debug');
    expect(env.NODE_ENV).toBe('production');
    expect(env.MONGODB_DB_NAME).toBe('biblio_test');
  });

  it('acepta URIs mongodb:// y mongodb+srv:// (Atlas)', () => {
    expect(
      parseEnv({ MONGODB_URI: 'mongodb+srv://user:pass@cluster0.ejemplo.mongodb.net' })
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
    expect(() => parseEnv({})).toThrow();
    expect(() => parseEnv({ MONGODB_URI: '' })).toThrow();
    expect(() => parseEnv({ MONGODB_URI: 'mysql://user@host/db' })).toThrow();
    expect(() => parseEnv({ MONGODB_URI: 'postgresql://user@host/db' })).toThrow();
  });
});
