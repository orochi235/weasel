import { vi } from 'vitest';
import type { ColorScheme } from '../colorScheme';

/**
 * Stub the global `matchMedia` so `prefers-color-scheme` answers `scheme`, and
 * return a setter that changes the answer and fires `change` on every list it
 * handed out, with `listeners` counting the subscriptions open. Undo with
 * `vi.unstubAllGlobals()`.
 */
export function stubColorScheme(scheme: ColorScheme): ((next: ColorScheme) => void) & { listeners: Set<() => void> } {
  let current = scheme;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() { return query.includes(`prefers-color-scheme: ${current}`); },
    addEventListener: (_: 'change', fn: () => void) => { listeners.add(fn); },
    removeEventListener: (_: 'change', fn: () => void) => { listeners.delete(fn); },
  }));
  const set = (next: ColorScheme) => {
    current = next;
    for (const fn of [...listeners]) fn();
  };
  return Object.assign(set, { listeners });
}
