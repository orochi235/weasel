import { vi } from 'vitest';
import type { ColorScheme } from '../colorScheme';

/** Changes what the stubbed media queries answer and fires `change` on every list handed out; `listeners` holds the subscriptions open. */
export type MediaSetter<T> = ((next: T) => void) & { listeners: Set<() => void> };

/**
 * Stub the global `matchMedia` so a query matches when `matches(query, value)` says so, starting from `initial`.
 * Undo with `vi.unstubAllGlobals()`.
 */
export function stubMatchMedia<T>(initial: T, matches: (query: string, value: T) => boolean): MediaSetter<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() { return matches(query, current); },
    addEventListener: (_: 'change', fn: () => void) => { listeners.add(fn); },
    removeEventListener: (_: 'change', fn: () => void) => { listeners.delete(fn); },
  }));
  const set = (next: T) => {
    current = next;
    for (const fn of [...listeners]) fn();
  };
  return Object.assign(set, { listeners });
}

/** `prefers-color-scheme` answers `scheme`. */
export const stubColorScheme = (scheme: ColorScheme): MediaSetter<ColorScheme> =>
  stubMatchMedia(scheme, (query, current) => query.includes(`prefers-color-scheme: ${current}`));

/** `(prefers-reduced-motion: reduce)` matches when `reduce` says so. */
export const stubReducedMotion = (reduce: boolean): MediaSetter<boolean> =>
  stubMatchMedia(reduce, (query, current) => current && query.includes('prefers-reduced-motion: reduce'));
