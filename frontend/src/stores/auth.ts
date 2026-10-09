import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { authApi } from '@/api/authApi';
import { refreshAccessToken } from '@/api/http';
import { getAccessToken, setAccessToken } from '@/api/token';
import type { AuthStatus, LoginRequest, RegisterRequest, User } from '@/types';

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}

/**
 * Sesión del usuario. El access token vive en memoria (`@/api/token`),
 * NUNCA en localStorage: al recargar la app se restaura vía `/auth/refresh`
 * (la cookie HttpOnly del refresh token la maneja el navegador).
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const status = ref<AuthStatus>('idle');
  const error = ref<string | null>(null);

  const accessToken = computed(() => getAccessToken());
  const isAuthenticated = computed(() => getAccessToken() !== null);
  const isAdmin = computed(() => user.value?.role === 'admin');

  function applySession(token: string, sessionUser: User): void {
    setAccessToken(token);
    user.value = sessionUser;
    status.value = 'idle';
    error.value = null;
  }

  function clearSession(): void {
    setAccessToken(null);
    user.value = null;
    status.value = 'idle';
  }

  async function login(input: LoginRequest): Promise<void> {
    status.value = 'loading';
    error.value = null;
    try {
      const response = await authApi.login(input);
      applySession(response.accessToken, response.user);
    } catch (err) {
      status.value = 'error';
      error.value = errorMessage(err);
      throw err;
    }
  }

  async function register(input: RegisterRequest): Promise<void> {
    status.value = 'loading';
    error.value = null;
    try {
      await authApi.register(input);
      // El backend no devuelve token en el registro: se inicia sesión de inmediato.
      const response = await authApi.login({
        email: input.email,
        password: input.password
      });
      applySession(response.accessToken, response.user);
    } catch (err) {
      status.value = 'error';
      error.value = errorMessage(err);
      throw err;
    }
  }

  async function logout(): Promise<void> {
    status.value = 'loading';
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }

  async function logoutAll(): Promise<void> {
    status.value = 'loading';
    try {
      await authApi.logoutAll();
    } finally {
      clearSession();
    }
  }

  async function refreshSession(): Promise<boolean> {
    try {
      const token = await refreshAccessToken();
      setAccessToken(token);
      status.value = 'idle';
      error.value = null;
      return true;
    } catch {
      clearSession();
      return false;
    }
  }

  /** Recupera el usuario actual desde `/auth/me` (tras restaurar la sesión). */
  async function fetchMe(): Promise<void> {
    const response = await authApi.fetchMe();
    user.value = response.user;
    status.value = 'idle';
  }

  return {
    user,
    status,
    error,
    accessToken,
    isAuthenticated,
    isAdmin,
    login,
    register,
    logout,
    logoutAll,
    refreshSession,
    fetchMe,
    clearSession
  };
});