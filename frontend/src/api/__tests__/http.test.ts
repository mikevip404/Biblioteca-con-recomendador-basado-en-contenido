import { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { http, refreshClient, resetHttpClientState } from '@/api/http';
import { getAccessToken, setAccessToken } from '@/api/token';
import { ApiError } from '@/types';
import type { RefreshResponse } from '@/types/auth';

const EMPTY_PAGE: Record<string, unknown> = {
  data: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0
};

function responseFor(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return { data, status, statusText: 'ERR', headers: {}, config };
}

function errorFor(config: InternalAxiosRequestConfig, status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_RESPONSE,
    config,
    undefined,
    responseFor(config, status, { error: { code: 'ERR', message: 'boom', correlationId: 'c-1' } })
  );
}

function networkErrorFor(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
}

/** Cambia el adapter de `http` por uno programado según decisión por petición. */
function setAdapter(
  decide: (config: InternalAxiosRequestConfig) => AxiosResponse | AxiosError
): void {
  http.defaults.adapter = async (config) => {
    const outcome = decide(config);
    if (outcome instanceof AxiosError) throw outcome;
    return outcome;
  };
}

describe('cliente HTTP', () => {
  beforeEach(() => {
    setAccessToken(null);
    setAdapter(() => responseFor({} as InternalAxiosRequestConfig, 200, EMPTY_PAGE));
  });

  afterEach(() => {
    setAccessToken(null);
    resetHttpClientState();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('añade correlation id y Bearer token cuando hay sesión', async () => {
    setAccessToken('token-x');
    const seen: InternalAxiosRequestConfig[] = [];
    setAdapter((config) => {
      seen.push(config);
      return responseFor(config, 200, EMPTY_PAGE);
    });

    await http.get('/books');

    expect(seen).toHaveLength(1);
    expect(seen[0]?.headers.get('x-correlation-id')).toBeTruthy();
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer token-x');
  });

  it('renueva la sesión una sola vez ante 401 simultáneos y reintenta ambas peticiones', async () => {
    const refreshSpy = vi.spyOn(refreshClient, 'post').mockResolvedValue({
      data: { accessToken: 'renovado' }
    } as AxiosResponse<RefreshResponse>);

    const calls: Record<string, number> = {};
    setAdapter((config) => {
      const path = config.url?.replace(/^\/api/, '') ?? '?';
      calls[path] = (calls[path] ?? 0) + 1;
      if (calls[path] === 1) return errorFor(config, 401);
      return responseFor(config, 200, EMPTY_PAGE);
    });

    const [books, authors] = await Promise.all([http.get('/books'), http.get('/authors')]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(books.status).toBe(200);
    expect(authors.status).toBe(200);
    expect(calls['/books']).toBe(2);
    expect(calls['/authors']).toBe(2);
    expect(getAccessToken()).toBe('renovado');
  });

  it('no reúsa el nuevo token si el refresh falla: rechaza y desactiva la renovación', async () => {
    vi.spyOn(refreshClient, 'post').mockRejectedValue(
      errorFor({} as InternalAxiosRequestConfig, 401)
    );
    let calls = 0;
    setAdapter((config) => {
      calls += 1;
      return errorFor(config, 401);
    });

    await expect(http.get('/books')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toBe(1);
    expect(getAccessToken()).toBeNull();
  });

  it('reintenta un GET 503 con backoff hasta que el servidor responde', async () => {
    vi.useFakeTimers();
    let calls = 0;
    setAdapter((config) => {
      calls += 1;
      if (calls <= 3) return errorFor(config, 503);
      return responseFor(config, 200, EMPTY_PAGE);
    });

    const done = vi.fn();
    http.get('/status').then((response) => done(response.status), () => done('err'));

    await vi.advanceTimersByTimeAsync(20_000);

    expect(calls).toBe(4);
    expect(done).toHaveBeenCalledWith(200);
  });

  it('para de reintentar tras 3 intentos cuando no hay conexión', async () => {
    vi.useFakeTimers();
    let calls = 0;
    setAdapter((config) => {
      calls += 1;
      return networkErrorFor(config);
    });

    const done = vi.fn();
    http.get('/offline').then(() => done('ok'), (err) => done(err));

    await vi.advanceTimersByTimeAsync(20_000);

    expect(calls).toBe(4);
    const result = done.mock.calls[0]?.[0] as ApiError;
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(0);
  });

  it('no reintenta un 404 (errores de cliente)', async () => {
    let calls = 0;
    setAdapter((config) => {
      calls += 1;
      return errorFor(config, 404);
    });

    await expect(http.get('/missing')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toBe(1);
  });

  it('no reintenta un POST que falla con 500', async () => {
    let calls = 0;
    setAdapter((config) => {
      calls += 1;
      return errorFor(config, 500);
    });

    await expect(http.post('/books', {})).rejects.toBeInstanceOf(ApiError);
    expect(calls).toBe(1);
  });
});