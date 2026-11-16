import { useCallback, useSyncExternalStore } from 'react';

const list = (query: string): MediaQueryList | null =>
  typeof matchMedia === 'function' ? matchMedia(query) : null;

/** Whether `query` matches now; `fallback` where there is no `matchMedia` to ask (a server render, jsdom). */
export function matchesMedia(query: string, fallback = false): boolean {
  return list(query)?.matches ?? fallback;
}

/** Call `onChange` whenever whether `query` matches changes. Returns the stop; a no-op with no `matchMedia`. */
export function watchMedia(query: string, onChange: () => void): () => void {
  const mq = list(query);
  mq?.addEventListener?.('change', onChange);
  return () => mq?.removeEventListener?.('change', onChange);
}

/** How {@link useMediaQuery} reads its query. */
export interface MediaQueryOptions {
  /** What it answers with no `matchMedia`, and in a server render. False by default. */
  fallback?: boolean;
  /** Re-render when the answer changes. True by default; with it false nothing is subscribed, and the answer is
   *  read afresh only when the caller renders for another reason. */
  follow?: boolean;
}

const still = () => () => {};

/** Whether `query` matches, re-rendering when that changes. */
export function useMediaQuery(query: string, options?: MediaQueryOptions): boolean {
  const fallback = options?.fallback ?? false;
  const follow = options?.follow ?? true;
  const subscribe = useCallback((onChange: () => void) => watchMedia(query, onChange), [query]);
  const read = useCallback(() => matchesMedia(query, fallback), [query, fallback]);
  const server = useCallback(() => fallback, [fallback]);
  return useSyncExternalStore(follow ? subscribe : still, read, server);
}
