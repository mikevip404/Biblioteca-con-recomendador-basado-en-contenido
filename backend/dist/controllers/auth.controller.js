import { HttpError } from '../middlewares/error.middleware.js';
import { REFRESH_COOKIE_NAME, clearRefreshCookie, setRefreshCookie } from '../utils/cookies.js';
/** Lee el refresh token de la cookie con narrowing (sin `any`). */
function readRefreshCookie(req) {
    const value = req.cookies?.[REFRESH_COOKIE_NAME];
    return typeof value === 'string' && value !== '' ? value : undefined;
}
function clientMeta(req) {
    const meta = {};
    const userAgent = req.get('user-agent');
    if (userAgent !== undefined && userAgent !== '')
        meta.userAgent = userAgent;
    if (req.ip !== undefined && req.ip !== '')
        meta.ipAddress = req.ip;
    return meta;
}
/**
 * Controlador de autenticación. Traduce HTTP ↔ AuthService y gestiona la
 * cookie del refresh token. El access token NUNCA va en cookie: viaja en el
 * cuerpo JSON para que el cliente lo guarde solo en memoria.
 */
export class AuthController {
    authService;
    cookieOptions;
    constructor(authService, cookieOptions) {
        this.authService = authService;
        this.cookieOptions = cookieOptions;
    }
    register = async (req, res, next) => {
        try {
            // `validate(registerSchema)` ya dejó `req.body` tipado y normalizado.
            const input = req.body;
            const user = await this.authService.register(input);
            const body = { user };
            res.status(201).json(body);
        }
        catch (error) {
            next(error);
        }
    };
    login = async (req, res, next) => {
        try {
            const input = req.body;
            const result = await this.authService.login(input, clientMeta(req));
            setRefreshCookie(res, result.refreshToken, {
                secure: this.cookieOptions.secure,
                maxAgeMs: this.cookieOptions.refreshMaxAgeMs
            });
            const body = {
                user: result.user,
                accessToken: result.accessToken
            };
            res.status(200).json(body);
        }
        catch (error) {
            next(error);
        }
    };
    refresh = async (req, res, next) => {
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
            const body = { accessToken: result.accessToken };
            res.status(200).json(body);
        }
        catch (error) {
            next(error);
        }
    };
    logout = async (req, res, next) => {
        try {
            await this.authService.logout(readRefreshCookie(req));
            clearRefreshCookie(res, this.cookieOptions.secure);
            res.status(204).end();
        }
        catch (error) {
            next(error);
        }
    };
    logoutAll = async (req, res, next) => {
        try {
            const user = req.user;
            if (user === undefined) {
                next(HttpError.unauthorized());
                return;
            }
            await this.authService.logoutAll(user.id);
            clearRefreshCookie(res, this.cookieOptions.secure);
            res.status(204).end();
        }
        catch (error) {
            next(error);
        }
    };
    me = async (req, res, next) => {
        try {
            const user = req.user;
            if (user === undefined) {
                next(HttpError.unauthorized());
                return;
            }
            const current = await this.authService.me(user.id);
            const body = { user: current };
            res.status(200).json(body);
        }
        catch (error) {
            next(error);
        }
    };
}
