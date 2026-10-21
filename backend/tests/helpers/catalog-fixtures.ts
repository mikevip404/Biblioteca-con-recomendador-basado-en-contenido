import { ObjectId } from 'mongodb';
import type { UserRole } from '../../src/types/auth.js';
import type { JwtTokenService } from '../../src/services/token.service.js';

export interface TestIdentity {
  id: string;
  token: string;
}

/** Genera una identidad con id ObjectId real y su access token firmado. */
export function makeIdentity(
  tokenService: JwtTokenService,
  role: UserRole
): TestIdentity {
  const id = new ObjectId().toString();
  return { id, token: tokenService.signAccessToken({ sub: id, role }) };
}

/** Cabecera Authorization lista para supertest. */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
