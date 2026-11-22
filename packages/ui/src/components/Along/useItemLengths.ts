import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { cssPx } from '../../cssPx';
import { compositeKey } from '@weasel-js/registry';
import { useLatest, watchResize } from '@weasel-js/react';

const same = (a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean =>
  a.size === b.size && [...a].every(([key, length]) => b.get(key) === length);

/** The key a child of a run's root is laid under, or null for a child that is not on the run. */
export type RunKeyOf = (child: Element) => string | null;

/** The elements under a run's root that may lie on it, in run order. Default: the root's own children. */
export type RunItemsOf = (root: HTMLElement) => Iterable<Element>;

const childrenOf: RunItemsOf = (root) => root.children;

/** A resize observer and the items it watches. */
export interface Watch {
  observer: ResizeObserver;
  watched: Set<Element>;
}

/** Points `watch` at `items`: each one newly there observed, each one gone since unobserved. */
export function rewatch(watch: Watch, items: Iterable<Element>): void {
  const seen = new Set(items);
  for (const child of watch.watched) if (!seen.has(child)) watch.observer.unobserve(child);
  for (const child of seen) if (!watch.watched.has(child)) watch.observer.observe(child);
  watch.watched = seen;
}

/**
 * The lengths of `el`'s items read into `known`, which keeps those of items no longer drawn while `keys` still names
 * them and lets go of the rest, each item then watched and any that left unwatched.
 */
function read(el: HTMLElement | null, keyOf: RunKeyOf, itemsOf: RunItemsOf, keys: readonly string[], known: Map<string, number>, watch: Watch | null): ReadonlyMap<string, number> {
  const keep = new Set(keys);
  const seen = new Set<Element>();
  for (const child of el === null ? [] : itemsOf(el)) {
    const key = keyOf(child);
    if (key === null || !('offsetWidth' in child)) continue;
    known.set(key, (child as HTMLElement).offsetWidth);
    keep.add(key);
    seen.add(child);
  }
  for (const key of known.keys()) if (!keep.has(key)) known.delete(key);
  if (watch !== null) rewatch(watch, seen);
  return new Map(known);
}

/**
 * Each item's untransformed width under `root`, by the key `keyOf` reads off it: an item tipped along a curve keeps
 * its layout width. Measured after every commit, before the
 * paint, and again when one resizes; an item off the line keeps the length it last had on it while `keys` names it.
 * A change to `keys` starts watching afresh, letting go of items no longer drawn. `keyOf` and `itemsOf` must keep their identity across
 * renders.
 */
export function useItemLengths(root: RefObject<HTMLElement | null>, keys: readonly string[], keyOf: RunKeyOf, itemsOf: RunItemsOf = childrenOf): ReadonlyMap<string, number> {
  const known = useRef(new Map<string, number>());
  const watch = useRef<Watch | null>(null);
  const [lengths, setLengths] = useState<ReadonlyMap<string, number>>(() => new Map());
  const signature = compositeKey(keys);
  const named = useLatest(keys);

  // A part like a bar's More button comes and goes with what fits, which no key says, so every commit looks again.
  useLayoutEffect(() => {
    const measure = (): void => {
      const next = read(root.current, keyOf, itemsOf, named.current, known.current, watch.current);
      setLengths((prev) => (same(prev, next) ? prev : next));
    };
    measure();
  });

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      const next = read(root.current, keyOf, itemsOf, named.current, known.current, watch.current);
      setLengths((prev) => (same(prev, next) ? prev : next));
    };
    watch.current = { observer: new ResizeObserver(measure), watched: new Set() };
    measure();
    return () => {
      watch.current?.observer.disconnect();
      watch.current = null;
    };
  }, [root, signature, keyOf, itemsOf, named]);
  return lengths;
}

/** The gap `root`'s stylesheet sets between two items along its line, read once it is laid out and again when it resizes. */
export function useRunGap(root: RefObject<HTMLElement | null>): number {
  const [gap, setGap] = useState(0);
  useLayoutEffect(() => {
    const el = root.current;
    if (el === null) return;
    const measure = (): void => setGap(cssPx(getComputedStyle(el).columnGap));
    measure();
    return watchResize(el, measure);
  }, [root]);
  return gap;
}
