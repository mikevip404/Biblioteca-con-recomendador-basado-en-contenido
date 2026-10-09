/** Roles del sistema. El rol por defecto al registrarse es `lector`. */
export type UserRole = 'admin' | 'lector';

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'lector';
}

/** Usuario autenticado que los middlewares adjuntan a la petición. */
export interface AuthUser {
  id: string;
  role: UserRole;
}

/** Carga útil del access token JWT. */
export interface AccessTokenPayload {
  /** Subject: id del usuario (ObjectId en hexadecimal). */
  sub: string;
  role: UserRole;
}

/** Datos públicos de usuario que viajan en las respuestas (nunca el hash). */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}
