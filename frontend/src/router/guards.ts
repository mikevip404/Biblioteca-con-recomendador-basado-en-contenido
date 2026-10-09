import type { NavigationGuardReturn, RouteLocationNormalized } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

let sessionRestored = false;

/** Reinicia el flag de restauración de sesión (para tests y HMR). */
export function resetSessionRestoredFlag(): void {
  sessionRestored = false;
}

/**
 * Guard global de autenticación.
 *
 * Antes de entrar a rutas protegidas espera a restaurar la sesión
 * (`/auth/refresh` + `/auth/me`) porque el access token vive solo en
 * memoria y se pierde al recargar. Sin sesión redirige a `/login`
 * conservando el destino en `?redirect`. Las rutas de invitado (login y
 * registro) redirigen al catálogo si ya hay sesión. `meta.roles` limita
 * el acceso a administradores.
 */
export async function authGuard(to: RouteLocationNormalized): Promise<NavigationGuardReturn> {
  const auth = useAuthStore();

  if (!sessionRestored) {
    const restored = await auth.refreshSession();
    if (restored) {
      try {
        await auth.fetchMe();
      } catch {
        auth.clearSession();
      }
    }
    sessionRestored = true;
  }

  const authenticated = auth.isAuthenticated;

  // Ruta protegida sin sesión → /login conservando el destino.
  if (to.meta.requiresAuth === true && !authenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  // Ruta de invitado con sesión → catálogo.
  if (to.meta.guest === true && authenticated) {
    return { name: 'books' };
  }

  // Ruta con roles restringidos y sin el rol necesario → /403.
  if (to.meta.roles !== undefined && authenticated) {
    const role = auth.user?.role;
    if (role === undefined || !to.meta.roles.includes(role)) {
      return { name: 'forbidden' };
    }
  }

  return true;
};