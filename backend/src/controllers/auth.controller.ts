import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { HttpError } from '../middlewares/error.middleware.js';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie
} from '../utils/cookies.js';
import type { PublicUser } from '../types/auth.js';

export interface AuthCookieOptions {
  secure: boolean;
  refreshMaxAgeMs: number;
}

interface UserBody {
  user: PublicUser;
}

interface TokenBody {
  accessToken: string;
}

/** Lee el refresh token de la cookie con narrowing (sin `any`). */
function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function clientMeta(req: Request): { userAgent?: string; ipAddress?: string } {
  const meta: { userAgent?: string; ipAddress?: string } = {};
  const userAgent = req.get('user-agent');
  if (userAgent !== undefined && userAgent !== '') meta.userAgent = userAgent;
  if (req.ip !== undefined && req.ip !== '') meta.ipAddress = req.ip;
  return meta;
}

/**
 * Controlador de autenticación. Traduce HTTP ↔ AuthService y gestiona la
 * cookie del refresh token. El access token NUNCA va en cookie: viaja en el
 * cuerpo JSON para que el cliente lo guarde solo en memoria.
 */
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieOptions: AuthCookieOptions
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // `validate(registerSchema)` ya dejó `req.body` tipado y normalizado.
      const input = req.body as { email: string; password: string; fullName: string };
      const user = await this.authService.register(input);
      const body: UserBody = { user };
      res.status(201).json(body);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as { email: string; password: string };
      const result = await this.authService.login(input, clientMeta(req));
      setRefreshCookie(res, result.refreshToken, {
        secure: this.cookieOptions.secure,
        maxAgeMs: this.cookieOptions.refreshMaxAgeMs
      });
      const body: UserBody & TokenBody = {
        user: result.user,
        accessToken: result.accessToken
      };
      res.status(200).json(body);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = readRefreshCookie(req);
      if (token === undefined) {
        next(HttpError.invalidRefreshToken());
        return;
      }
      const result = await this.authService.refresh(token, clientMeta(req));
      setRefreshCookie(res, result.refreshToken, {
        secure: this.cookieOptions.secure,
        maxAgeMs: this.cookieOptions.refreshMaxAgeMs
      });
      const body: TokenBody = { accessToken: result.accessToken };
      res.status(200).json(body);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.logout(readRefreshCookie(req));
      clearRefreshCookie(res, this.cookieOptions.secure);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };

  logoutAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next(HttpError.unauthorized());
        return;
      }
      await this.authService.logoutAll(user.id);
      clearRefreshCookie(res, this.cookieOptions.secure);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next(HttpError.unauthorized());
        return;
      }
      const current = await this.authService.me(user.id);
      const body: UserBody = { user: current };
      res.status(200).json(body);
    } catch (error) {
      next(error);
    }
  };
}
