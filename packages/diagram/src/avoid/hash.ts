/**
 * A uniform spatial hash: each item is filed under every square cell its box
 * touches, so a query visits only the items near it.
 */
import type { Box } from './types';

/** The cell size the router's hashes use, in world units. */
export const CELL = 128;

/** An item as filed: `seen` marks the query that last returned it. */
interface Filed<T> {
  item: T;
  seen: number;
}

export class SpatialHash<T> {
  private readonly cells = new Map<number, Filed<T>[]>();
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
    const filed: Filed<T> = { item, seen: 0 };
    const [i0, j0, i1, j1] = this.range(box);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = SpatialHash.key(i, j);
        const list = this.cells.get(k);
        if (list === undefined) this.cells.set(k, [filed]);
        else list.push(filed);
      }
    }
  }

  /** Every item filed in a cell `box` touches, each once. */
  query(box: Box, out: T[] = []): T[] {
    const [i0, j0, i1, j1] = this.range(box);
    const stamp = ++this.query_;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const list = this.cells.get(SpatialHash.key(i, j));
        if (list === undefined) continue;
        for (const filed of list) {
          if (filed.seen === stamp) continue;
          filed.seen = stamp;
          out.push(filed.item);
        }
      }
    }
    return out;
  }
}
