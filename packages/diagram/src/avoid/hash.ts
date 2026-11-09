/**
 * A uniform spatial hash: each item is filed under every square cell its box
 * touches, so a query visits only the items near it.
 */
import type { Box } from './types';

/** The cell size the router's hashes use, in world units. */
export const CELL = 128;

/** Cells an item or a query walks before it is checked against every item instead. */
const MAX_CELLS = 4096;

/** An item as filed: `seen` marks the query that last returned it. */
interface Filed<T> {
  item: T;
  box: Box;
  seen: number;
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

/** How many cells `[i0, i1] × [j0, j1]` holds; past {@link MAX_CELLS}, or not finite, it is too many to walk.
 *  Nor can indices past a safe integer be walked, as `i++` stops moving there. */
const walkable = (range: readonly number[]): boolean => {
  const [i0, j0, i1, j1] = range;
  return (i1! - i0! + 1) * (j1! - j0! + 1) <= MAX_CELLS && range.every(Number.isSafeInteger);
};

export class SpatialHash<T> {
  private readonly cells = new Map<number, Filed<T>[]>();
  /** Items spanning too many cells to file in each, checked by box on every query. */
  private readonly wide: Filed<T>[] = [];
  private query_ = 0;

  constructor(private readonly cell = CELL) {}

  /** The key of cell `(i, j)`. Packs both into one number for the map. */
  private static key(i: number, j: number): number {
    return (i + 0x8000) * 0x10000 + (j + 0x8000);
  }

  private range(box: Box): [number, number, number, number] {
    const c = this.cell;
    return [Math.floor(box.x / c), Math.floor(box.y / c), Math.floor((box.x + box.width) / c), Math.floor((box.y + box.height) / c)];
  }

  insert(item: T, box: Box): void {
    const filed: Filed<T> = { item, box, seen: 0 };
    const range = this.range(box);
    if (!walkable(range)) {
      this.wide.push(filed);
      return;
    }
    const [i0, j0, i1, j1] = range;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = SpatialHash.key(i, j);
        const list = this.cells.get(k);
        if (list === undefined) this.cells.set(k, [filed]);
        else list.push(filed);
      }
    }
  }

  /** Take `item`, filed under `box`, back out. */
  remove(item: T, box: Box): void {
    const range = this.range(box);
    if (!walkable(range)) {
      const at = this.wide.findIndex((f) => f.item === item);
      if (at >= 0) this.wide.splice(at, 1);
      return;
    }
    const [i0, j0, i1, j1] = range;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const list = this.cells.get(SpatialHash.key(i, j));
        const at = list?.findIndex((f) => f.item === item) ?? -1;
        if (at >= 0) list!.splice(at, 1);
      }
    }
  }

  /** Every item filed in a cell `box` touches, each once. */
  query(box: Box, out: T[] = []): T[] {
    const range = this.range(box);
    const stamp = ++this.query_;
    const take = (filed: Filed<T>): void => {
      if (filed.seen === stamp) return;
      filed.seen = stamp;
      out.push(filed.item);
    };
    for (const filed of this.wide) if (overlaps(filed.box, box)) take(filed);
    if (!walkable(range)) {
      for (const list of this.cells.values()) for (const filed of list) if (overlaps(filed.box, box)) take(filed);
      return out;
    }
    const [i0, j0, i1, j1] = range;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const list = this.cells.get(SpatialHash.key(i, j));
        if (list !== undefined) for (const filed of list) take(filed);
      }
    }
    return out;
  }
}
