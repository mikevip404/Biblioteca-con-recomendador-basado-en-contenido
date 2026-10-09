import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { authApi } from '@/api/authApi';
import { refreshAccessToken } from '@/api/http';
import { getAccessToken, setAccessToken } from '@/api/token';
import { useAuthStore } from '@/stores/auth';
import { ApiError } from '@/types';
import type { User } from '@/types';

vi.mock('@/api/authApi', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    fetchMe: vi.fn()
  }
}));

vi.mock('@/api/http', () => ({
  refreshAccessToken: vi.fn()
}));

const user: User = {
  id: 'u1',
  email: 'ana@example.com',
  fullName: 'Ana',
  role: 'lector'
};

const mockedLogin = vi.mocked(authApi.login);
const mockedRegister = vi.mocked(authApi.register);
const mockedLogout = vi.mocked(authApi.logout);
const mockedRefresh = vi.mocked(refreshAccessToken);

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setAccessToken(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    setAccessToken(null);
  });

  it('inicia sesión y guarda el token y el usuario', async () => {
    mockedLogin.mockResolvedValue({ user, accessToken: 'token-1' });
    const store = useAuthStore();

    await store.login({ email: user.email, password: 'secret' });

    expect(store.isAuthenticated).toBe(true);
    expect(store.user).toEqual(user);
    expect(store.status).toBe('idle');
    expect(getAccessToken()).toBe('token-1');
  });

  it('deja el estado en error si el login falla', async () => {
    mockedLogin.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas'));
    const store = useAuthStore();

    await expect(store.login({ email: user.email, password: 'mala' })).rejects.toBeInstanceOf(ApiError);

    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(store.status).toBe('error');
    expect(store.error).toBe('Credenciales inválidas');
  });

  it('tras registrar inicia sesión automáticamente', async () => {
    const registerInput = { email: user.email, password: 'secret', fullName: user.fullName };
    mockedRegister.mockResolvedValue({ user });
    mockedLogin.mockResolvedValue({ user, accessToken: 'token-2' });
    const store = useAuthStore();

    await store.register(registerInput);

    expect(mockedRegister).toHaveBeenCalledTimes(1);
    expect(mockedRegister).toHaveBeenCalledWith(registerInput);
    expect(mockedLogin).toHaveBeenCalledTimes(1);
    expect(mockedLogin).toHaveBeenCalledWith({
      email: user.email,
      password: 'secret'
    });
    expect(store.isAuthenticated).toBe(true);
    expect(getAccessToken()).toBe('token-2');
  });

  it('limpia la sesión al cerrar sesión aunque la API falle', async () => {
    mockedLogout.mockRejectedValue(new ApiError(500, 'INTERNAL', 'Error'));
    setAccessToken('token-3');
    const store = useAuthStore();
    store.user = user;

    await expect(store.logout()).rejects.toBeInstanceOf(ApiError);

    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('restaura la sesión con refreshAccessToken', async () => {
    mockedRefresh.mockResolvedValue('token-renovado');
    const store = useAuthStore();

    const restored = await store.refreshSession();

    expect(restored).toBe(true);
    expect(getAccessToken()).toBe('token-renovado');
    expect(store.status).toBe('idle');
  });

  it('descartar la sesión si no se puede renovar', async () => {
    mockedRefresh.mockRejectedValue(new ApiError(401, 'INVALID_TOKEN', 'Sesión inválida'));
    setAccessToken('token-caduco');
    const store = useAuthStore();

    const restored = await store.refreshSession();

    expect(restored).toBe(false);
    expect(store.isAuthenticated).toBe(false);
    expect(getAccessToken()).toBeNull();
  });

  it('recupera el perfil del usuario con fetchMe', async () => {
    const me = { ...user, role: 'admin' as const };
    vi.mocked(authApi.fetchMe).mockResolvedValue({ user: me });
    const store = useAuthStore();

    await store.fetchMe();

    expect(store.user).toEqual(me);
    expect(store.isAdmin).toBe(true);
  });
});