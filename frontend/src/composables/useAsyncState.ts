import { ref, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';

import { ApiError } from '@/types';

/**
 * Estado asíncrono reutilizable: carga, error y dato de una tarea (p. ej.
 * llamada a la API). Las vistas consumen `errorMessage` para los mensajes
 * accesibles y `retry` para el botón "Reintentar".
 */
export interface AsyncState<T> {
  data: ShallowRef<T | null>;
  loading: { value: boolean };
  error: { value: ApiError | null };
  errorMessage: { value: string | null };
  execute: () => Promise<void>;
  setData: (value: T) => void;
  reset: () => void;
}

export interface AsyncStateOptions {
  /** Ejecutar la tarea inmediatamente al crear el estado. */
  immediate?: boolean;
}

export function useAsyncState<T>(
  task: () => Promise<T>,
  options: AsyncStateOptions = {}
): AsyncState<T> {
  const data = shallowRef<T | null>(null);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  const errorMessage = ref<string | null>(null);

  async function execute(): Promise<void> {
    loading.value = true;
    error.value = null;
    errorMessage.value = null;
    try {
      data.value = await task();
    } catch (err) {
      if (err instanceof ApiError) {
        error.value = err;
        errorMessage.value = err.message;
      } else {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        error.value = null;
        errorMessage.value = message;
      }
    } finally {
      loading.value = false;
    }
  }

  function setData(value: T): void {
    data.value = value;
  }

  function reset(): void {
    data.value = null;
    loading.value = false;
    error.value = null;
    errorMessage.value = null;
  }

  if (options.immediate === true) {
    void execute();
  }

  return { data, loading, error, errorMessage, execute, setData, reset };
}