import { useSyncExternalStore } from 'react';
import { createPart } from '@weasel-js/registry';

/** Something that calls `fn` on each change it makes, until the returned function stops it. */
export interface Notifier {
  subscribe(fn: () => void): () => void;
}

/** How many times each source has notified since anything first read it here. */
const countOf = createPart((source: Notifier): { n: number } => {
  const c = { n: 0 };
  // Held for the source's life, so a change between a render and its effect is counted too.
  source.subscribe(() => { c.n++; });
  return c;
});

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
/** `source.subscribe` bound to it, one function per source, so React keeps one subscription across renders. */
const subscribeOf = createPart((source: Notifier): ((fn: () => void) => () => void) => (fn) => source.subscribe(fn));
