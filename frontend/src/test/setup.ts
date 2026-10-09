import { beforeEach, afterEach } from 'vitest';
import type { Theme } from '@/types';

// jsdom no implementa matchMedia: se simula para las preferencias de tema.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }) as unknown as MediaQueryList
});

// Limpia el tema/layout entre pruebas y reinicia el dom de jsdom.
beforeEach(() => {
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = '';
  const theme = localStorage.getItem('biblioteca:theme') as Theme | null;
  if (theme !== null) localStorage.removeItem('biblioteca:theme');
});

afterEach(() => {
  document.body.innerHTML = '';
});