import { describe, expect, it } from 'vitest';
import {
  InvalidTokenError,
  JwtTokenService
} from '../../src/services/token.service.js';

const SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres!!';

function makeService(ttlSec = 900): JwtTokenService {
  return new JwtTokenService({ secret: SECRET, accessTokenTtlSec: ttlSec });
}

describe('JwtTokenService', () => {
  it('firma y verifica un access token (roundtrip)', () => {
    const service = makeService();

    const token = service.signAccessToken({ sub: '507f1f77bcf86cd799439011', role: 'lector' });
    const user = service.verifyAccessToken(token);

    expect(user).toEqual({ id: '507f1f77bcf86cd799439011', role: 'lector' });
  });

  it('rechaza tokens firmados con otro secreto', () => {
    const other = new JwtTokenService({
      secret: 'otro-secreto-distinto-con-32-o-mas-caracteres!!',
      accessTokenTtlSec: 900
    });
    const token = other.signAccessToken({ sub: '507f1f77bcf86cd799439011', role: 'lector' });

    expect(() => makeService().verifyAccessToken(token)).toThrow(InvalidTokenError);
  });

  it('rechaza tokens expirados', () => {
    // TTL negativo: el token nace ya vencido.
    const expired = makeService(-60).signAccessToken({
      sub: '507f1f77bcf86cd799439011',
      role: 'lector'
    });

    expect(() => makeService().verifyAccessToken(expired)).toThrow(InvalidTokenError);
  });

  it('rechaza tokens manipulados o con forma inválida', () => {
    const service = makeService();
    const token = service.signAccessToken({ sub: '507f1f77bcf86cd799439011', role: 'lector' });

    expect(() => service.verifyAccessToken(token + 'x')).toThrow(InvalidTokenError);
    expect(() => service.verifyAccessToken('basura')).toThrow(InvalidTokenError);
  });

  it('genera refresh tokens únicos de 96 caracteres hexadecimales', () => {
    const service = makeService();
    const first = service.generateRefreshToken();
    const second = service.generateRefreshToken();

    expect(first).toMatch(/^[0-9a-f]{96}$/);
    expect(first).not.toBe(second);
  });

  it('el hash SHA-256 es determinista, de 64 hex y distinto del original', () => {
    const service = makeService();
    const token = service.generateRefreshToken();

    const first = service.hashToken(token);
    expect(first).toBe(service.hashToken(token));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain(token);
  });
});
