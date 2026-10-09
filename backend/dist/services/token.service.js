import { randomBytes, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { isUserRole } from '../types/auth.js';
/** Error tipado para fallos de verificación del access token. */
export class InvalidTokenError extends Error {
    constructor(message = 'Token inválido o expirado') {
        super(message);
        this.name = 'InvalidTokenError';
    }
}
export class JwtTokenService {
    options;
    constructor(options) {
        this.options = options;
    }
    signAccessToken(payload) {
        return jwt.sign({ sub: payload.sub, role: payload.role }, this.options.secret, { expiresIn: this.options.accessTokenTtlSec });
    }
    verifyAccessToken(token) {
        let decoded;
        try {
            decoded = jwt.verify(token, this.options.secret);
        }
        catch {
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
    generateRefreshToken() {
        return randomBytes(48).toString('hex');
    }
    hashToken(token) {
        return createHash('sha256').update(token, 'utf8').digest('hex');
    }
}
