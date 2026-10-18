import { vi } from 'vitest';

/**
 * Stub the global `matchMedia` so `(prefers-reduced-motion: reduce)` matches
 * when `reduce` says so, and return a setter that changes the answer and fires
 * `change` on every list it handed out. Undo with `vi.unstubAllGlobals()`.
 */
export function stubReducedMotion(reduce: boolean): (next: boolean) => void {
  let matches = reduce;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() { return query.includes('prefers-reduced-motion: reduce') && matches; },
    addEventListener: (_: 'change', fn: () => void) => { listeners.add(fn); },
    removeEventListener: (_: 'change', fn: () => void) => { listeners.delete(fn); },
  }));
  return (next) => {
    matches = next;
    for (const fn of [...listeners]) fn();
  };
}
