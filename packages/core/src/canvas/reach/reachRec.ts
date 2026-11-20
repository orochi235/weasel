/** One node's entry in a reach tree, and the slab its two boxes live in. */
import { BOX_NONE, type BoxKind } from './reachTypes';
import type { WideChildren } from './wideChildren';

export class ReachRec {
  parent: ReachRec | null = null;
  own: BoxKind = BOX_NONE;
  reach: BoxKind = BOX_NONE;
  tags = 0;
  reachTags = 0;
  ownStale = true;
  /** Its children changed: their ranks, and whether it is wide. */
  childrenStale = true;
  /** A change to its children may have reordered them, so a wide one re-ranks. */
  orderMoved = false;
  queued = false;
  wide: WideChildren | null = null;
  /** Its place among its siblings, read when its parent is wide. */
  rank = 0;
  /** The last query epoch that met it. */
  seen = 0;
  constructor(readonly id: string | null, readonly slot: number) {}
}

/** Both boxes of every record: own at `slot * 4d`, reach `2d` after. Freed slots are reused. */
export class ReachSlab {
  data: Float64Array;
  private readonly free: number[] = [];
  private next = 0;
  readonly stride: number;

  constructor(readonly dim: number, capacity = 64) {
    this.stride = 4 * dim;
    this.data = new Float64Array(capacity * this.stride);
  }

  alloc(): number {
    const slot = this.free.pop() ?? this.next++;
    if ((slot + 1) * this.stride > this.data.length) {
      const grown = new Float64Array(Math.max(this.data.length * 2, (slot + 1) * this.stride));
      grown.set(this.data);
      this.data = grown;
    }
    return slot;
  }

  release(slot: number): void {
    this.free.push(slot);
  }

  ownAt(rec: ReachRec): number {
    return rec.slot * this.stride;
  }

  reachAt(rec: ReachRec): number {
    return rec.slot * this.stride + 2 * this.dim;
  }

  /** A view of `rec`'s reach box; valid until the slab next grows. */
  reachOf(rec: ReachRec): Float64Array {
    const at = this.reachAt(rec);
    return this.data.subarray(at, at + 2 * this.dim);
  }

  /** Slots in use, for a memory reading. */
  get used(): number {
    return this.next - this.free.length;
  }
}
