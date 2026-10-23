import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

const same = (a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean =>
  a.size === b.size && [...a].every(([key, length]) => b.get(key) === length);

/** The key a child of a run's root is laid under, or null for a child that is not on the run. */
export type RunKeyOf = (child: Element) => string | null;

/** The elements under a run's root that may lie on it, in run order. Default: the root's own children. */
export type RunItemsOf = (root: HTMLElement) => Iterable<Element>;

const childrenOf: RunItemsOf = (root) => root.children;

/** The lengths of `el`'s items read into `known`, which keeps those of items no longer drawn, each item then watched. */
function read(el: HTMLElement | null, keyOf: RunKeyOf, itemsOf: RunItemsOf, known: Map<string, number>, observer: ResizeObserver | null): ReadonlyMap<string, number> {
  for (const child of el === null ? [] : itemsOf(el)) {
    const key = keyOf(child);
    if (key === null || !(child instanceof HTMLElement)) continue;
    known.set(key, child.offsetWidth);
    observer?.observe(child);
  }
  return new Map(known);
}

/**
 * Each item's untransformed width under `root`, by the key `keyOf` reads off it: an item tipped along a curve keeps
 * its layout width. Measured after every commit, before the
 * paint, and again when one resizes; an item off the line keeps the length it last had on it. A change to `keys`
 * starts watching afresh, letting go of items no longer drawn. `keyOf` and `itemsOf` must keep their identity across
 * renders.
 */
export function useItemLengths(root: RefObject<HTMLElement | null>, keys: readonly string[], keyOf: RunKeyOf, itemsOf: RunItemsOf = childrenOf): ReadonlyMap<string, number> {
  const known = useRef(new Map<string, number>());
  const observer = useRef<ResizeObserver | null>(null);
  const [lengths, setLengths] = useState<ReadonlyMap<string, number>>(() => new Map());
  const signature = keys.join('\n');

  // A part like a bar's More button comes and goes with what fits, which no key says, so every commit looks again.
  useLayoutEffect(() => {
    const measure = (): void => {
      const next = read(root.current, keyOf, itemsOf, known.current, observer.current);
      setLengths((prev) => (same(prev, next) ? prev : next));
    };
    measure();
  });

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      const next = read(root.current, keyOf, itemsOf, known.current, observer.current);
      setLengths((prev) => (same(prev, next) ? prev : next));
    };
    observer.current = new ResizeObserver(measure);
    measure();
    return () => {
      observer.current?.disconnect();
      observer.current = null;
    };
  }, [root, signature, keyOf, itemsOf]);
  return lengths;
}

/** The gap `root`'s stylesheet sets between two items along its line, read once it is laid out and again when it resizes. */
export function useRunGap(root: RefObject<HTMLElement | null>): number {
  const [gap, setGap] = useState(0);
  useLayoutEffect(() => {
    const el = root.current;
    if (el === null) return;
    const measure = (): void => setGap(Number.parseFloat(getComputedStyle(el).columnGap) || 0);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);
  return gap;
}
