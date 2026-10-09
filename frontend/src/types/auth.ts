/** Roles del sistema (mismos valores que el backend). */
export type UserRole = 'admin' | 'lector';

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'lector';
}

/** Usuario tal como viaja en las respuestas de la API. */
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

/** Cuerpo de `POST /auth/register`. */
export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

/** Cuerpo de `POST /auth/login`. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Respuesta de `POST /auth/login`: usuario + access token en memoria. */
export interface LoginResponse {
  user: User;
  accessToken: string;
}

/** Respuesta de `POST /auth/register`: solo el usuario creado (sin token). */
export interface RegisterResponse {
  user: User;
}

/** Respuesta de `POST /auth/refresh`: nuevo access token. */
export interface RefreshResponse {
  accessToken: string;
}

/** Respuesta de `GET /auth/me`. */
export interface MeResponse {
  user: User;
}

/** Estados del ciclo de autenticación. */
export type AuthStatus = 'idle' | 'loading' | 'error';

/** Preferencias de tema de la interfaz. */
export type Theme = 'light' | 'dark';