/**
 * The children of one wide container, indexed by their reach: a BVH over the
 * bounded ones and a list of those nothing bounds, so a query costs what it
 * finds rather than the child count.
 */
import { createBvh, type Bvh } from '@weasel-js/geom/nd';
import { boxMeets } from './reachRegion';
import { BOX_ALL, BOX_SOME, type ReachQuery, type ReachRegion } from './reachTypes';
import type { ReachRec, ReachSlab } from './reachRec';

export class WideChildren {
  private bvh: Bvh<ReachRec>;
  private readonly always = new Set<ReachRec>();
  /** Every tag a child carries. It only grows until the next {@link WideChildren.load}. */
  tags = 0;
  /** Whether each child's `rank` still says its place among its siblings. */
  ranksStale = true;
  /** The rank the next child joining at the end takes. */
  nextRank = 0;
  private epoch = 0;

  constructor(private readonly slab: ReachSlab) {
    this.bvh = createBvh(slab.dim);
  }

  load(kids: readonly ReachRec[]): void {
    this.always.clear();
    this.tags = 0;
    const entries: [ReachRec, Float64Array][] = [];
    for (const k of kids) {
      this.tags |= k.reachTags;
      if (k.reach === BOX_ALL) this.always.add(k);
      else if (k.reach === BOX_SOME) entries.push([k, this.slab.reachOf(k)]);
    }
    this.bvh = createBvh(this.slab.dim, entries);
    this.ranksStale = true;
  }

  /** Take `rec`'s reach as it is now. */
  put(rec: ReachRec): void {
    this.tags |= rec.reachTags;
    if (rec.reach === BOX_SOME) {
      this.always.delete(rec);
      if (!this.bvh.insert(rec, this.slab.reachOf(rec))) this.always.add(rec);
      return;
    }
    this.bvh.remove(rec);
    if (rec.reach === BOX_ALL) this.always.add(rec);
    else this.always.delete(rec);
  }

  drop(rec: ReachRec): void {
    this.bvh.remove(rec);
    this.always.delete(rec);
  }

  /** Write a box holding every child's reach at `out[at…]`: false when none has one, `'all'` when one is unbounded. */
  bounds(out: Float64Array, at: number): boolean | 'all' {
    if (this.always.size > 0) return 'all';
    return this.bvh.bounds(out, at);
  }

  /** The children whose reach meets `q`, in no order. */
  meeting(q: ReachQuery, out: ReachRec[]): void {
    const epoch = ++this.epoch;
    const { slab } = this;
    const take = (rec: ReachRec): boolean => {
      if (rec.seen === epoch) return true;
      rec.seen = epoch;
      if (boxMeets(rec.reach, rec.reachTags, slab.data, slab.reachAt(rec), slab.dim, q)) out.push(rec);
      return true;
    };
    for (const rec of this.always) take(rec);
    let bits = q.wanted & this.tags;
    const asked = new Set<ReachRegion>();
    while (bits !== 0) {
      const bit = 31 - Math.clz32(bits);
      bits &= ~(1 << bit);
      const region = q.regions[bit];
      if (region === undefined) {
        // A wanted tag with no region meets everywhere: every child is a candidate.
        this.bvh.queryBox(EVERYWHERE[slab.dim] ??= everywhere(slab.dim), take);
        return;
      }
      if (asked.has(region)) continue;
      asked.add(region);
      if ('box' in region) this.bvh.queryBox(region.box, take);
      else this.bvh.queryHalfSpaces(region.planes, take);
    }
  }
}

const EVERYWHERE: Float64Array[] = [];

function everywhere(dim: number): Float64Array {
  const box = new Float64Array(2 * dim);
  box.fill(-Number.MAX_VALUE, 0, dim);
  box.fill(Number.MAX_VALUE, dim);
  return box;
}
