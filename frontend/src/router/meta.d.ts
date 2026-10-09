import type { UserRole } from '@/types';

declare module 'vue-router' {
  interface RouteMeta {
    /** Requiere sesión iniciada para entrar. */
    requiresAuth?: boolean;
    /** Ruta de invitado: redirige al catálogo si ya hay sesión. */
    guest?: boolean;
    /** Roles permitidos (administrador). */
    roles?: UserRole[];
    /** Título de documento. */
    title?: string;
  }
}

export {};