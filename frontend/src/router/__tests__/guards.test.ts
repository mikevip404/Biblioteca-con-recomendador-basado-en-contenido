import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';

import { authGuard, resetSessionRestoredFlag } from '@/router/guards';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn()
}));

interface FakeAuthStore {
  isAuthenticated: boolean;
  user: User | null;
  refreshSession: ReturnType<typeof vi.fn>;
  fetchMe: ReturnType<typeof vi.fn>;
  clearSession: ReturnType<typeof vi.fn>;
}

function createFakeStore(): FakeAuthStore {
  const store: FakeAuthStore = {
    isAuthenticated: false,
    user: null,
    refreshSession: vi.fn(async () => store.isAuthenticated),
    fetchMe: vi.fn(async () => {}),
    clearSession: vi.fn(() => {
      store.isAuthenticated = false;
      store.user = null;
    })
  };
  return store;
}

function signIn(store: FakeAuthStore, as: User): void {
  store.isAuthenticated = true;
  store.user = as;
}

function loginPage(): User {
  return { id: 'u1', email: 'admin@example.com', fullName: 'Admin', role: 'admin' };
}

const lector: User = { id: 'u2', email: 'lib@example.com', fullName: 'Lib', role: 'lector' };

function to(fullPath: string, meta: Record<string, unknown>): RouteLocationNormalized {
  return { fullPath, name: fullPath, meta } as unknown as RouteLocationNormalized;
}

describe('authGuard', () => {
  const mockedUseAuthStore = vi.mocked(useAuthStore);
  let store: FakeAuthStore;

  beforeEach(() => {
    resetSessionRestoredFlag();
    store = createFakeStore();
    mockedUseAuthStore.mockReset();
    mockedUseAuthStore.mockReturnValue(store as unknown as ReturnType<typeof useAuthStore>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sin sesión redirige a /login conservando el destino en ?redirect', async () => {
    const guard = await authGuard(to('/books', { requiresAuth: true }));

    expect(guard).toEqual({ name: 'login', query: { redirect: '/books' } });
    expect(store.refreshSession).toHaveBeenCalledTimes(1);
    expect(store.fetchMe).not.toHaveBeenCalled();
  });

  it('permite pasar a rutas protegidas cuando la sesión se restaura', async () => {
    signIn(store, loginPage());
    store.refreshSession.mockResolvedValue(true);

    const guard = await authGuard(to('/books', { requiresAuth: true }));

    expect(guard).toBe(true);
    expect(store.fetchMe).toHaveBeenCalledTimes(1);
  });

  it('restaura la sesión una sola vez por ciclo de vida', async () => {
    signIn(store, loginPage());
    store.refreshSession.mockResolvedValue(true);

    await authGuard(to('/books', { requiresAuth: true }));
    await authGuard(to('/books', { requiresAuth: true }));

    expect(store.refreshSession).toHaveBeenCalledTimes(1);
    expect(store.fetchMe).toHaveBeenCalledTimes(1);
  });

  it('lava la sesión si /auth/me falla tras restaurar', async () => {
    signIn(store, loginPage());
    store.refreshSession.mockResolvedValue(true);
    store.fetchMe.mockRejectedValue(new Error('sin conexión'));

    const guard = await authGuard(to('/books', { requiresAuth: true }));

    expect(store.clearSession).toHaveBeenCalledTimes(1);
    expect(guard).toEqual({ name: 'login', query: { redirect: '/books' } });
  });

  it('deja entrar a las rutas de invitado sin sesión', async () => {
    const guard = await authGuard(to('/login', { guest: true }));

    expect(guard).toBe(true);
  });

  it('saca del login al catálogo si ya hay sesión', async () => {
    signIn(store, loginPage());
    store.refreshSession.mockResolvedValue(true);

    const guard = await authGuard(to('/login', { guest: true }));

    expect(guard).toEqual({ name: 'books' });
  });

  it('bloquea el acceso por rol a /403', async () => {
    signIn(store, lector);
    store.refreshSession.mockResolvedValue(true);

    const guard = await authGuard(to('/admin', { requiresAuth: true, roles: ['admin'] }));

    expect(guard).toEqual({ name: 'forbidden' });
  });

  it('deja pasar al admin en rutas restringidas', async () => {
    signIn(store, loginPage());
    store.refreshSession.mockResolvedValue(true);

    const guard = await authGuard(to('/admin', { requiresAuth: true, roles: ['admin'] }));

    expect(guard).toBe(true);
  });
});