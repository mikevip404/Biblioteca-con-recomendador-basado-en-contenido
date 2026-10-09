import axios from 'axios';
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import type { RefreshResponse } from '@/types/auth';
import { ApiError, isApiErrorPayload } from '@/types/api';
import type { ApiErrorOptions } from '@/types/api';

import { getAccessToken, setAccessToken } from './token';

/** Base de la API: sale de `import.meta.env` y cae en el proxy de Vite. */
const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';

/** Reintentos máximos para errores de red/5xx en GET. */
const MAX_RETRIES = 3;
/** No se renueva la sesión más de una vez cada 5s (evita bucles de 401). */
const REFRESH_COOLDOWN_MS = 5_000;

/** Endpoints de auth: un 401 allí no debe disparar una renovación (sería un bucle). */
const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/logout-all'
];

function isAuthEndpoint(url: string | undefined): boolean {
  return AUTH_ENDPOINTS.some((endpoint) => url?.endsWith(endpoint) ?? false);
}

let sequence = 0;

/** Genera un correlation id estable por petición (traza en los logs del backend). */
function createCorrelationId(): string {
  sequence = (sequence + 1) % 0xffffff;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${time}-${rand}-${sequence.toString(36).padStart(4, '0')}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function backoffDelay(attempt: number): number {
  return 300 * 2 ** (attempt - 1);
}

/** Convierte un error de Axios en un `ApiError` con el formato uniforme del backend. */
function toApiError(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;
  const payload = error.response?.data;
  if (payload !== undefined && isApiErrorPayload(payload)) {
    const options: ApiErrorOptions = {};
    if (payload.error.correlationId !== undefined) {
      options.correlationId = payload.error.correlationId;
    }
    if (payload.error.details !== undefined) {
      options.details = payload.error.details;
    }
    return new ApiError(status, payload.error.code, payload.error.message, options);
  }
  const message =
    error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED'
      ? 'No se pudo conectar con el servidor'
      : error.message !== '' ? error.message : 'Error de red desconocido';
  return new ApiError(status, 'NETWORK_ERROR', message);
}

/**
 * Renovación de sesión en "single flight": solo hay una llamada a
 * `/auth/refresh` a la vez; el resto de peticiones 401 esperan la misma
 * promesa y reintentan con el nuevo token cuando esta resuelve.
 */
let refreshPromise: Promise<string> | null = null;
let lastRefreshAt = 0;
let refreshDisabled = false;

/**
 * Cliente "crudo" solo para renovar la sesión (sin reintentos ni nuevos 401).
 * Se exporta para poder espiar las llamadas en las pruebas.
 */
export const refreshClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true
});

refreshClient.interceptors.request.use((config) => {
  config.headers.set('x-correlation-id', createCorrelationId());
  return config;
});

async function performRefresh(): Promise<string> {
  const response = await refreshClient.post<RefreshResponse>('/auth/refresh');
  return response.data.accessToken;
}

function queueRefresh(): Promise<string> {
  const now = Date.now();
  if (refreshDisabled || now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
    return Promise.reject(
      new ApiError(401, 'SESSION_NOT_RENEWABLE', 'La sesión no se puede renovar')
    );
  }
  if (refreshPromise !== null) {
    return refreshPromise;
  }
  refreshPromise = performRefresh()
    .then((token) => {
      lastRefreshAt = Date.now();
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/**
 * Renueva la sesión de forma explícita (p. ej. al restaurarla al arrancar la
 * app, porque el access token vive solo en memoria). Si falla, se desactiva
 * la renovación automática hasta el próximo login.
 */
export async function refreshAccessToken(): Promise<string> {
  try {
    return await queueRefresh();
  } catch (error) {
    refreshDisabled = true;
    throw error;
  }
}

/** Re-armar la renovación tras un login/registro correcto. */
export function resetSessionRefreshGuard(): void {
  refreshDisabled = false;
}

/**
 * Restablece el estado interno del cliente (cooldown, guard y handler de
 * sesión expirada). Para pruebas aisladas y HMR.
 */
export function resetHttpClientState(): void {
  refreshDisabled = false;
  lastRefreshAt = 0;
  refreshPromise = null;
  sessionExpiredHandler = null;
}

let sessionExpiredHandler: (() => void) | null = null;

/** El consumidor (Store/Router) usa esto para limpiar la sesión al expirar. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

function triggerSessionExpired(): void {
  if (sessionExpiredHandler !== null) {
    sessionExpiredHandler();
  }
}

/** Cabecera interna que cuenta los reintentos de una petición (la conserva Axios). */
const RETRY_HEADER = 'x-retry-count';

function retryCountOf(config: InternalAxiosRequestConfig): number {
  const raw = config.headers.get(RETRY_HEADER);
  if (typeof raw !== 'string') return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) ? parsed : 0;
}

function shouldRetry(error: AxiosError): boolean {
  const config = error.config;
  if (config === undefined || config.method?.toLowerCase() !== 'get') return false;
  if (retryCountOf(config) >= MAX_RETRIES) return false;
  // Error de red (sin respuesta) o 5xx: reintenta con backoff exponencial.
  if (error.response === undefined) return true;
  return error.response.status >= 500 && error.response.status <= 599;
}

/** Cliente HTTP tipado del catálogo (login incluido). Proxyeado a `:3000` en dev. */
export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true
});

http.interceptors.request.use((config) => {
  config.headers.set('x-correlation-id', createCorrelationId());
  const token = getAccessToken();
  if (token !== null) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return Promise.reject(new ApiError(0, 'UNKNOWN_ERROR', message));
    }

    const config = error.config;

    // 401 en un endpoint normal → renovar sesión UNA vez y reintentar.
    if (
      error.response?.status === 401 &&
      config !== undefined &&
      !isAuthEndpoint(config.url)
    ) {
      try {
        const token = await queueRefresh();
        setAccessToken(token);
        return http({ ...config });
      } catch {
        refreshDisabled = true;
        setAccessToken(null);
        triggerSessionExpired();
        return Promise.reject(toApiError(error));
      }
    }

    // Errores de red y 5xx en GET → backoff exponencial (máx. 3 reintentos).
    if (config !== undefined && shouldRetry(error)) {
      const retries = retryCountOf(config);
      const retried: InternalAxiosRequestConfig = { ...config };
      retried.headers.set(RETRY_HEADER, String(retries + 1));
      await delay(backoffDelay(retries + 1));
      return http(retried);
    }

    return Promise.reject(toApiError(error));
  }
);