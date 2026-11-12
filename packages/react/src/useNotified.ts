import { useSyncExternalStore } from 'react';

/** Something that calls `fn` on each change it makes, until the returned function stops it. */
export interface Notifier {
  subscribe(fn: () => void): () => void;
}

/** How many times each source has notified since anything first read it here. */
const COUNTS = new WeakMap<Notifier, { n: number }>();

function countOf(source: Notifier): { n: number } {
  let count = COUNTS.get(source);
  if (count === undefined) {
    const c = { n: 0 };
    // Held for the source's life, so a change between a render and its effect is counted too.
    source.subscribe(() => { c.n++; });
    COUNTS.set(source, (count = c));
  }
  return count;
}

/**
 * Re-renders on each change `source.subscribe` reports, and returns how many there have been. For a source read as
 * plain properties, with no snapshot of its own: a change made after the render read it and before an effect could
 * subscribe still re-renders, as `useSyncExternalStore` promises. `null` subscribes to nothing.
 */
export function useNotified(source: Notifier | null): number {
  const count = source === null ? null : countOf(source);
  return useSyncExternalStore(
    source === null ? NONE : subscribeOf(source),
    () => count?.n ?? 0,
  );
}

const NONE = (): (() => void) => () => {};
const BOUND = new WeakMap<Notifier, (fn: () => void) => () => void>();

/** `source.subscribe` bound to it, one function per source, so React keeps one subscription across renders. */
function subscribeOf(source: Notifier): (fn: () => void) => () => void {
  let bound = BOUND.get(source);
  if (bound === undefined) BOUND.set(source, (bound = (fn) => source.subscribe(fn)));
  return bound;
}
