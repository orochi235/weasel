import { matchesMedia, useMediaQuery } from './media';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Whether the reader has asked for less motion. False where there is no `matchMedia` to ask. */
export function prefersReducedMotion(): boolean {
  return matchesMedia(QUERY);
}

/** {@link prefersReducedMotion}, re-rendering when the preference changes. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(QUERY);
}
