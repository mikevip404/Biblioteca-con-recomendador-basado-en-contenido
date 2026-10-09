/** Nombre de la cookie del refresh token. */
export const REFRESH_COOKIE_NAME = 'refresh_token';
/**
 * Cookie del refresh token: HttpOnly (inaccesible desde JS → anti-XSS),
 * SameSite=Strict (anti-CSRF) y path acotado a /api/auth para que el
 * navegador solo la envíe a los endpoints de autenticación.
 */
export function setRefreshCookie(res, token, security) {
    res.cookie(REFRESH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: security.secure,
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: security.maxAgeMs
    });
}
/** Borra la cookie. El `path` debe coincidir con el usado al crearla. */
export function clearRefreshCookie(res, secure) {
    res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        path: '/api/auth'
    });
}
