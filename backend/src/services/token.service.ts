import { randomBytes, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  isUserRole,
  type AccessTokenPayload,
  type AuthUser
} from '../types/auth.js';

/** Error tipado para fallos de verificación del access token. */
export class InvalidTokenError extends Error {
  constructor(message = 'Token inválido o expirado') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

/**
 * Puerto del servicio de tokens. La autenticación depende de esta interfaz,
 * no de `jsonwebtoken` ni de `crypto` directamente.
 */
export interface TokenService {
  signAccessToken(payload: AccessTokenPayload): string;
  verifyAccessToken(token: string): AuthUser;
  /** Cadena aleatoria de 384 bits para refresh tokens (solo en memoria/cookie). */
  generateRefreshToken(): string;
  /** SHA-256 del refresh token: lo único que se persiste en la BD. */
  hashToken(token: string): string;
}

export interface TokenServiceOptions {
  secret: string;
  /** Tiempo de vida del access token en segundos. */
  accessTokenTtlSec: number;
}

export class JwtTokenService implements TokenService {
  constructor(private readonly options: TokenServiceOptions) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(
      { sub: payload.sub, role: payload.role },
      this.options.secret,
      { expiresIn: this.options.accessTokenTtlSec }
    );
  }

  verifyAccessToken(token: string): AuthUser {
    let decoded: string | jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, this.options.secret);
    } catch {
      throw new InvalidTokenError();
    }
    if (typeof decoded === 'string') {
      throw new InvalidTokenError();
    }
    const { sub, role } = decoded;
    if (typeof sub !== 'string' || !isUserRole(role)) {
      throw new InvalidTokenError();
    }
    return { id: sub, role };
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString('hex');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
