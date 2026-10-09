/** Debounce tipado: la función devuelta también expone `cancel()`. */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  waitMs: number
): ((...args: TArgs) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: TArgs): void => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };

  debounced.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = null;
  };

  return debounced;
}