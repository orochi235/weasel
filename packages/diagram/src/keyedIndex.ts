/**
 * A hit index rebuilt when its source's key changes, built on the second read
 * at a key (`createSettledCache`). A source with no key (`undefined`) is never
 * indexed: every read answers null, so the caller scans.
 */
import { createBvh, createSettledCache, type Bvh } from '@weasel-js/geom/nd';

export function keyedIndex<T>(key: () => readonly unknown[] | undefined, build: () => T): () => T | null {
  const cache = createSettledCache<T>();
  return () => {
    const now = key();
    return now === undefined ? null : cache.read(now, build);
  };
}

/** A 2D BVH over `boxes` (`[minX, minY, maxX, maxY]`), keyed by position. A box the tree
 *  refuses (non-finite or inverted) goes on `always`, for every query to read. */
export interface BoxIndex {
  tree: Bvh<number>;
  always: readonly number[];
}

export function boxIndex(boxes: readonly (readonly [number, number, number, number])[]): BoxIndex {
  const entries: [number, readonly number[]][] = [];
  const always: number[] = [];
  boxes.forEach((b, i) => {
    if (b.every(Number.isFinite) && b[0] <= b[2] && b[1] <= b[3]) entries.push([i, b]);
    else always.push(i);
  });
  return { tree: createBvh<number>(2, entries), always };
}

/** Positions of the boxes meeting `[x0, y0, x1, y1]`, grown by a relative epsilon so rounding
 *  only ever adds one, ascending; null for a query with a NaN in it, which meets nothing. */
export function boxesMeeting(index: BoxIndex, x0: number, y0: number, x1: number, y1: number): number[] | null {
  const q = [x0, y0, x1, y1];
  if (q.some(Number.isNaN)) return null;
  const e = 1e-9 * (1 + Math.max(0, ...q.filter(Number.isFinite).map(Math.abs)));
  const found = [...index.always];
  index.tree.queryBox([x0 - e, y0 - e, x1 + e, y1 + e], (i) => { found.push(i); });
  return found.sort((a, b) => a - b);
}
