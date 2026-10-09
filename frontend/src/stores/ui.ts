import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { Theme } from '@/types';

const THEME_KEY = 'biblioteca:theme';
const PAGE_SIZE_KEY = 'biblioteca:pageSize';
const DEFAULT_PAGE_SIZE = 20;

function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage puede no estar disponible (modo privado); se ignora.
  }
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function readPageSize(): number {
  try {
    const stored = window.localStorage.getItem(PAGE_SIZE_KEY);
    if (stored !== null) {
      const parsed = Number.parseInt(stored, 10);
      if (Number.isInteger(parsed) && parsed >= 5 && parsed <= 50) {
        return parsed;
      }
    }
  } catch {
    // Se usa el valor por defecto.
  }
  return DEFAULT_PAGE_SIZE;
}

function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }
}

/**
 * Preferencias de UI. Es la ÚNICA pieza con persistencia (localStorage) y
 * solo guarda preferencias: NUNCA tokens ni datos sensibles.
 */
export const useUiStore = defineStore('ui', () => {
  const theme = ref<Theme>(readTheme());
  const pageSize = ref<number>(readPageSize());

  applyTheme(theme.value);

  function setTheme(value: Theme): void {
    theme.value = value;
    applyTheme(value);
    try {
      window.localStorage.setItem(THEME_KEY, value);
    } catch {
      // Solo preferencia: si no se puede persistir, la sesión la conserva.
    }
  }

  function toggleTheme(): void {
    setTheme(theme.value === 'dark' ? 'light' : 'dark');
  }

  function setPageSize(value: number): void {
    pageSize.value = value;
    try {
      window.localStorage.setItem(PAGE_SIZE_KEY, String(value));
    } catch {
      // Solo preferencia.
    }
  }

  return { theme, pageSize, setTheme, toggleTheme, setPageSize };
});