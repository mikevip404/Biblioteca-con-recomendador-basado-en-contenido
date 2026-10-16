import { ref } from 'vue';
import { defineStore } from 'pinia';

/** Tipo de aviso; determina el estilo y la urgencia (`role`). */
export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

/** Duración por defecto de un aviso antes de autodescartarse. */
export const TOAST_TIMEOUT_MS = 5_000;

let nextId = 1;

/**
 * Cola de notificaciones efímeras (toasts) propias, sin librerías. Se monta
 * una sola vez en `ToastHost`. Los avisos de error no se autodescartan para
 * que el usuario pueda leerlos.
 */
export const useToastsStore = defineStore('toasts', () => {
  const items = ref<Toast[]>([]);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  function dismiss(id: number): void {
    items.value = items.value.filter((toast) => toast.id !== id);
    const timer = timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }

  /** Encoda un aviso y lo autodescarta (excepto los errores). */
  function notify(
    message: string,
    type: ToastType = 'info',
    timeoutMs: number = TOAST_TIMEOUT_MS
  ): number {
    const id = nextId;
    nextId += 1;
    items.value = [...items.value, { id, type, message }];
    if (type !== 'error' && timeoutMs > 0) {
      const timer = setTimeout(() => dismiss(id), timeoutMs);
      timers.set(id, timer);
    }
    return id;
  }

  function success(message: string): number {
    return notify(message, 'success');
  }

  function error(message: string): number {
    return notify(message, 'error');
  }

  function clear(): void {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    items.value = [];
  }

  return { items, notify, success, error, dismiss, clear };
});
