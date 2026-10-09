/**
 * Única fuente de verdad del access token.
 *
 * Vive SOLO en memoria (nunca en localStorage/sessionStorage): al recargar
 * la página se pierde y la sesión se restaura vía `/auth/refresh` (la cookie
 * HttpOnly del refresh token la guarda el navegador).
 */
import { ref } from 'vue';

const accessToken = ref<string | null>(null);

/** Guarda el access token en memoria. Pasa `null` para cerrar sesión. */
export function setAccessToken(token: string | null): void {
  accessToken.value = token;
}

export function getAccessToken(): string | null {
  return accessToken.value;
}