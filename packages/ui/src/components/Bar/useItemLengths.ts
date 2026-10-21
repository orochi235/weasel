import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { BAR_ITEM, BAR_LEAD, BAR_MORE } from './useBarOverflow';

const same = (a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean =>
  a.size === b.size && [...a].every(([key, length]) => b.get(key) === length);

/** The key a child of the bar is measured under: its item key, else `BAR_MORE` or `BAR_LEAD`. */
function keyOf(child: Element): string | null {
  return child.getAttribute(BAR_ITEM) ?? (child.hasAttribute(BAR_MORE) ? BAR_MORE : child.hasAttribute(BAR_LEAD) ? BAR_LEAD : null);
}

/** The lengths of `el`'s items read into `known`, which keeps those of items no longer drawn, each item then watched. */
function read(el: HTMLElement | null, known: Map<string, number>, observer: ResizeObserver | null): ReadonlyMap<string, number> {
  for (const child of el?.children ?? []) {
    const key = keyOf(child);
    if (key === null || !(child instanceof HTMLElement)) continue;
    known.set(key, child.offsetWidth);
    observer?.observe(child);
  }
  return new Map(known);
}

/**
 * Each item's untransformed width under `root`, by key: an item tipped along a curve keeps its layout width.
 * The More button is under `BAR_MORE` and the lead under `BAR_LEAD`. Measured after every commit, before the
 * paint, and again when one resizes; an item off the line keeps the length it last had on it. A change to `keys`
 * starts watching afresh, letting go of items no longer drawn.
 */
export function useItemLengths(root: RefObject<HTMLElement | null>, keys: readonly string[]): ReadonlyMap<string, number> {
  const known = useRef(new Map<string, number>());
  const observer = useRef<ResizeObserver | null>(null);
  const [lengths, setLengths] = useState<ReadonlyMap<string, number>>(() => new Map());
  const signature = keys.join('\n');

  // The More button comes and goes with what fits, which no key says, so every commit looks again.
  useLayoutEffect(() => {
    const measure = (): void => {
      const next = read(root.current, known.current, observer.current);
      setLengths((prev) => (same(prev, next) ? prev : next));
    };
    measure();
  });

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      const next = read(root.current, known.current, observer.current);
      setLengths((prev) => (same(prev, next) ? prev : next));
    };
    observer.current = new ResizeObserver(measure);
    measure();
    return () => {
      observer.current?.disconnect();
      observer.current = null;
    };
  }, [root, signature]);
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
