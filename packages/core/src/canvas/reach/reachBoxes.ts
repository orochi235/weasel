/**
 * A reach tree's records and how they recompute: each node's own box read
 * from the source, its reach from its own and its children's, and the queue
 * that recomputes touched records deepest first and climbs while a reach
 * moves.
 */
import { sameBox, unionInto } from './reachRegion';
import { ReachRec, ReachSlab } from './reachRec';
import { BOX_ALL, BOX_NONE, BOX_SOME, type BoxKind, type ReachSource } from './reachTypes';
import { WideChildren } from './wideChildren';

export class ReachBoxes {
  slab: ReachSlab;
  recs = new Map<string, ReachRec>();
  root: ReachRec;
  /** Records waiting to recompute, by depth, deepest drained first. */
  private queue: ReachRec[][] = [];
  private readonly scratch: Float64Array;
  private readonly image: Float64Array;

  constructor(private readonly source: ReachSource, private readonly wideAt: number, capacity = 64) {
    this.slab = new ReachSlab(source.dim, capacity);
    this.root = new ReachRec(null, this.slab.alloc());
    this.scratch = new Float64Array(2 * source.dim);
    this.image = new Float64Array(2 * source.dim);
  }

  recOf(id: string | null): ReachRec | undefined {
    return id === null ? this.root : this.recs.get(id);
  }

  enqueue(rec: ReachRec): void {
    if (rec.queued) return;
    rec.queued = true;
    let d = 0;
    for (let p = rec.parent; p !== null; p = p.parent) d++;
    (this.queue[d] ??= []).push(rec);
  }

  create(id: string): ReachRec {
    const rec = new ReachRec(id, this.slab.alloc());
    this.recs.set(id, rec);
    return rec;
  }

  drop(rec: ReachRec): void {
    rec.parent?.wide?.drop(rec);
    if (rec.parent) this.enqueue(rec.parent);
    this.recs.delete(rec.id!);
    this.slab.release(rec.slot);
  }

  /** Box every node under the roots, bottom up. */
  build(): void {
    const visit = (rec: ReachRec): void => {
      this.readOwn(rec);
      for (const k of this.source.childrenOf(rec.id)) {
        const c = this.create(k);
        c.parent = rec;
        visit(c);
      }
      this.recompute(rec);
    };
    visit(this.root);
  }

  /** Recompute every queued record, deepest first, and each ancestor whose child's reach moved. */
  drain(): void {
    const { queue } = this;
    for (let d = queue.length - 1; d >= 0; d--) {
      const level = queue[d];
      if (level === undefined) continue;
      for (let i = 0; i < level.length; i++) {
        const rec = level[i]!;
        rec.queued = false;
        if (rec.id !== null && !this.recs.has(rec.id)) continue;
        const moved = this.recompute(rec);
        const joined = rec.joined;
        rec.joined = false;
        if ((!moved && !joined) || rec.parent === null) continue;
        rec.parent.wide?.put(rec);
        this.enqueue(rec.parent);
      }
    }
    this.queue = [];
  }

  private readOwn(rec: ReachRec): void {
    if (rec.id === null) {
      rec.own = BOX_NONE;
      rec.tags = 0;
    } else {
      rec.own = this.source.ownBox(rec.id, this.slab.data, this.slab.ownAt(rec));
      rec.tags = this.source.tagsOf(rec.id);
    }
    rec.ownStale = false;
  }

  /** Fit a container's child index to how many children it has now. */
  private fitWide(rec: ReachRec, kids: readonly string[]): void {
    const wide = kids.length >= this.wideAt || (rec.wide !== null && kids.length >= this.wideAt / 2);
    if (!wide) {
      rec.wide = null;
    } else if (rec.wide === null) {
      rec.wide = new WideChildren(this.slab);
      const list: ReachRec[] = [];
      for (const k of kids) {
        const c = this.recs.get(k);
        if (c) list.push(c);
      }
      rec.wide.load(list);
    } else if (rec.orderMoved) {
      rec.wide.ranksStale = true;
    }
    rec.orderMoved = false;
    rec.childrenStale = false;
  }

  /** The union of `rec`'s children's reaches, written into `image`, and their tags. */
  private childrenReach(rec: ReachRec, kids: readonly string[]): { kind: BoxKind; tags: number } {
    const { slab, image } = this;
    if (rec.wide !== null) {
      const b = rec.wide.bounds(image, 0);
      return { kind: b === 'all' ? BOX_ALL : b ? BOX_SOME : BOX_NONE, tags: rec.wide.tags };
    }
    let kind: BoxKind = BOX_NONE;
    let tags = 0;
    for (const k of kids) {
      const c = this.recs.get(k);
      if (c === undefined) continue;
      kind = unionInto(image, 0, kind, slab.data, slab.reachAt(c), c.reach, slab.dim);
      tags |= c.reachTags;
    }
    return { kind, tags };
  }

  /** Recompute `rec`'s reach from its own box and its children's reaches. True when it moved. */
  private recompute(rec: ReachRec): boolean {
    if (rec.ownStale) this.readOwn(rec);
    const kids = this.source.childrenOf(rec.id);
    if (rec.childrenStale) this.fitWide(rec, kids);
    const { slab, scratch, image } = this;
    const dim = slab.dim;
    const at = slab.reachAt(rec);
    const was = rec.reach;
    const wasTags = rec.reachTags;
    scratch.set(slab.data.subarray(at, at + 2 * dim));
    const { kind, tags } = this.childrenReach(rec, kids);
    let reach = unionInto(slab.data, at, BOX_NONE, slab.data, slab.ownAt(rec), rec.own, dim);
    reach = unionInto(slab.data, at, reach, image, 0, kind, dim);
    const images = rec.id !== null && kind !== BOX_NONE ? this.source.imagesOf?.(rec.id) : null;
    for (const map of images ?? []) {
      if (kind === BOX_ALL) {
        reach = BOX_ALL;
        break;
      }
      const out = new Float64Array(2 * dim);
      if (map(image, 0, out, 0) === BOX_ALL) {
        reach = BOX_ALL;
        break;
      }
      reach = unionInto(slab.data, at, reach, out, 0, BOX_SOME, dim);
    }
    rec.reach = reach;
    rec.reachTags = rec.tags | tags;
    return reach !== was || rec.reachTags !== wasTags || (reach === BOX_SOME && !sameBox(slab.data, at, scratch, 0, dim));
  }
}
