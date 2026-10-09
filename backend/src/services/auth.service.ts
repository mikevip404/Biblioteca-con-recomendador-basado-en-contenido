import { randomUUID } from 'node:crypto';
import { HttpError } from '../middlewares/error.middleware.js';
import type {
  RefreshTokenRepository
} from '../repositories/refresh-token.repository.js';
import type { User, UserRepository } from '../repositories/user.repository.js';
import type { PasswordService } from './password.service.js';
import type { TokenService } from './token.service.js';
import type { PublicUser } from '../types/auth.js';

export interface AuthConfig {
  accessTokenTtlSec: number;
  refreshTokenTtlDays: number;
  /** Máximo de sesiones vigentes por usuario; al exceder se revoca la más antigua. */
  maxSessions: number;
  /** Fallos seguidos antes de bloquear temporalmente la cuenta. */
  maxLoginAttempts: number;
  /** Duración del bloqueo en minutos. */
  lockMinutes: number;
}

export interface ClientMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

const MS_PER_DAY = 86_400_000;

function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}

/**
 * Lógica de autenticación. No conoce Express ni el driver de Mongo:
 * solo repositorios, servicios de apoyo y configuración inyectada.
 */
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: RefreshTokenRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: AuthConfig
  ) {}

  async register(input: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<PublicUser> {
    const existing = await this.users.findByEmail(input.email);
    if (existing !== null) {
      throw HttpError.conflict('El correo ya está registrado');
    }
    const passwordHash = await this.passwords.hash(input.password);
    // El rol SIEMPRE es lector aquí: promoverse a admin solo es posible con
    // el script de semilla o una actualización directa de un admin.
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: 'lector'
    });
    return toPublicUser(user);
  }

  async login(
    input: { email: string; password: string },
    meta: ClientMeta = {}
  ): Promise<LoginResult> {
    const user = await this.users.findByEmail(input.email);

    if (user !== null && this.isLocked(user, new Date())) {
      throw HttpError.locked('Cuenta bloqueada temporalmente por intentos fallidos');
    }

    // Mensaje genérico a propósito: no revela si falló el email, la clave
    // o si la cuenta está inactiva (anti-enumeración).
    const valid =
      user !== null &&
      user.isActive &&
      (await this.passwords.verify(user.passwordHash, input.password));
    if (!valid) {
      if (user !== null) {
        await this.recordFailedAttempt(user);
      }
      throw HttpError.invalidCredentials();
    }

    await this.users.updateLoginState(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null
    });

    const session = await this.createSession(user.id, randomUUID(), meta);
    await this.enforceSessionLimit(user.id);

    return {
      accessToken: this.tokens.signAccessToken({ sub: user.id, role: user.role }),
      refreshToken: session.refreshToken,
      user: toPublicUser(user)
    };
  }

  async refresh(token: string, meta: ClientMeta = {}): Promise<RefreshResult> {
    const session = await this.sessions.findByTokenHash(this.tokens.hashToken(token));
    if (session === null) {
      throw HttpError.invalidRefreshToken();
    }
    if (session.revokedAt !== null) {
      // REUTILIZACIÓN: el token ya fue rotado o revocado. Posible robo:
      // se revoca TODA la familia y se responde 401.
      await this.sessions.revokeFamily(session.familyId, new Date());
      throw HttpError.sessionReused();
    }
    if (session.expiresAt <= new Date()) {
      await this.sessions.revokeById(session.id, new Date());
      throw HttpError.invalidRefreshToken('Sesión expirada');
    }

    const user = await this.users.findById(session.userId);
    if (user === null || !user.isActive) {
      await this.sessions.revokeById(session.id, new Date());
      throw HttpError.invalidRefreshToken();
    }

    // Rotación: se invalida el token presentado y se emite uno nuevo
    // dentro de la MISMA familia (conserva el linaje de la sesión).
    await this.sessions.revokeById(session.id, new Date());
    const next = await this.createSession(user.id, session.familyId, meta);

    return {
      accessToken: this.tokens.signAccessToken({ sub: user.id, role: user.role }),
      refreshToken: next.refreshToken,
      user: toPublicUser(user)
    };
  }

  /** Revoca la sesión del token dado. Idempotente: token ausente = nada que hacer. */
  async logout(token: string | undefined): Promise<void> {
    if (token === undefined || token === '') return;
    const session = await this.sessions.findByTokenHash(this.tokens.hashToken(token));
    if (session === null || session.revokedAt !== null) return;
    await this.sessions.revokeById(session.id, new Date());
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessions.revokeAllByUser(userId, new Date());
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw HttpError.unauthorized('Usuario no encontrado');
    }
    return toPublicUser(user);
  }

  private isLocked(user: User, now: Date): boolean {
    return user.lockedUntil !== null && user.lockedUntil > now;
  }

  private async recordFailedAttempt(user: User): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    if (attempts >= this.config.maxLoginAttempts) {
      // Bloqueo temporal y contador reiniciado: al expirar el bloqueo
      // el usuario parte de cero.
      await this.users.updateLoginState(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: new Date(Date.now() + this.config.lockMinutes * 60_000)
      });
      return;
    }
    await this.users.updateLoginState(user.id, {
      failedLoginAttempts: attempts,
      lockedUntil: null
    });
  }

  private async createSession(
    userId: string,
    familyId: string,
    meta: ClientMeta
  ): Promise<{ refreshToken: string }> {
    const refreshToken = this.tokens.generateRefreshToken();
    await this.sessions.create({
      userId,
      tokenHash: this.tokens.hashToken(refreshToken),
      familyId,
      expiresAt: new Date(Date.now() + this.config.refreshTokenTtlDays * MS_PER_DAY),
      ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
      ...(meta.ipAddress !== undefined ? { ipAddress: meta.ipAddress } : {})
    });
    return { refreshToken };
  }

  /** Si hay más sesiones vigentes que el máximo, revoca las más antiguas. */
  private async enforceSessionLimit(userId: string): Promise<void> {
    const active = await this.sessions.findActiveByUser(userId, new Date());
    const excess = active.length - this.config.maxSessions;
    for (let i = 0; i < excess; i++) {
      const oldest = active[i];
      if (oldest !== undefined) {
        await this.sessions.revokeById(oldest.id, new Date());
      }
    }
  }
}
