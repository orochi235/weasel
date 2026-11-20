/**
 * The reach tree: each node's own box, and its reach — own and every
 * descendant's, under each copy its container paints — kept up to date from
 * the scene's touched-ids feed. A touched node and its ancestors recompute;
 * nothing else does. A container with many children indexes them in a BVH
 * ({@link WideChildren}), so asking which of them meet a region costs what
 * it finds.
 *
 * It is generic over dimension and over the box: the render index boxes
 * paint, the pick indexes their broad boxes, kernel3d its 3D boxes.
 */
import { boxMeets, sameBox, unionInto } from './reachRegion';
import { ReachRec, ReachSlab } from './reachRec';
import { BOX_ALL, BOX_NONE, BOX_SOME, type ReachQuery, type ReachSource } from './reachTypes';
import { WideChildren } from './wideChildren';

/** Children past which a container indexes them; below half of it, it stops. */
export const WIDE_AT = 64;

export interface ReachTree {
  /** Bring every box up to date with the scene. */
  ensure(): void;
  /** Forget every box: the next {@link ReachTree.ensure} builds from the whole scene. */
  invalidate(): void;
  /** Those of `children`, the children of `parent` (`null` for the roots), whose reach meets `q`, in order. */
  childrenMeeting(parent: string | null, children: readonly string[], q: ReachQuery): readonly string[];
  /** Every node whose own box meets `q`, in tree preorder. */
  collect(q: ReachQuery, visit: (id: string) => void): void;
  /** The own box of `id` as kept, for a reader that tests it exactly. */
  ownOf(id: string): { kind: number; box: Float64Array; at: number } | undefined;
  /** How often it built from the whole scene, and how many nodes it holds. */
  stats(): { builds: number; records: number; wide: number };
}

let totalBuilds = 0;

/** How many reach trees have been built from a whole scene, for tests and benches that pin when one rebuilds. */
export function reachTreeBuildCount(): number {
  return totalBuilds;
}

export function createReachTree(source: ReachSource, wideAt = WIDE_AT): ReachTree {
  const { dim } = source;
  let slab = new ReachSlab(dim);
  let recs = new Map<string, ReachRec>();
  let root = new ReachRec(null, slab.alloc());
  let token: number | null = null;
  let builds = 0;
  /** Records waiting to recompute, by depth, deepest drained first. */
  let queue: ReachRec[][] = [];
  const scratch = new Float64Array(2 * dim);
  const image = new Float64Array(2 * dim);

  const recOf = (id: string | null): ReachRec | undefined => (id === null ? root : recs.get(id));

  function depthOf(rec: ReachRec): number {
    let d = 0;
    for (let p = rec.parent; p !== null; p = p.parent) d++;
    return d;
  }

  function enqueue(rec: ReachRec): void {
    if (rec.queued) return;
    rec.queued = true;
    (queue[depthOf(rec)] ??= []).push(rec);
  }

  function create(id: string): ReachRec {
    const rec = new ReachRec(id, slab.alloc());
    recs.set(id, rec);
    return rec;
  }

  function drop(rec: ReachRec): void {
    rec.parent?.wide?.drop(rec);
    if (rec.parent) enqueue(rec.parent);
    recs.delete(rec.id!);
    slab.release(rec.slot);
  }

  function readOwn(rec: ReachRec): void {
    if (rec.id === null) {
      rec.own = BOX_NONE;
      rec.tags = 0;
    } else {
      rec.own = source.ownBox(rec.id, slab.data, slab.ownAt(rec));
      rec.tags = source.tagsOf(rec.id);
    }
    rec.ownStale = false;
  }

  /** Fit a container's child index to how many children it has now. */
  function fitWide(rec: ReachRec, kids: readonly string[]): void {
    const wide = kids.length >= wideAt || (rec.wide !== null && kids.length >= wideAt / 2);
    if (!wide) {
      rec.wide = null;
    } else if (rec.wide === null) {
      rec.wide = new WideChildren(slab);
      const list: ReachRec[] = [];
      for (const k of kids) {
        const c = recs.get(k);
        if (c) list.push(c);
      }
      rec.wide.load(list);
    } else {
      rec.wide.ranksStale = true;
    }
    rec.childrenStale = false;
  }

  /** Recompute `rec`'s reach from its own box and its children's reaches. True when it moved. */
  function recompute(rec: ReachRec): boolean {
    if (rec.ownStale) readOwn(rec);
    const kids = source.childrenOf(rec.id);
    if (rec.childrenStale) fitWide(rec, kids);
    const at = slab.reachAt(rec);
    const was = rec.reach;
    const wasTags = rec.reachTags;
    scratch.set(slab.data.subarray(at, at + 2 * dim));
    // Children first, into `scratch`'s twin `image`, so a copy can map their union.
    let kind = BOX_NONE as typeof rec.reach;
    let tags = 0;
    if (rec.wide !== null) {
      const b = rec.wide.bounds(image, 0);
      kind = b === 'all' ? BOX_ALL : b ? BOX_SOME : BOX_NONE;
      tags = rec.wide.tags;
    } else {
      for (const k of kids) {
        const c = recs.get(k);
        if (c === undefined) continue;
        kind = unionInto(image, 0, kind, slab.data, slab.reachAt(c), c.reach, dim);
        tags |= c.reachTags;
      }
    }
    let reach = unionInto(slab.data, at, BOX_NONE, slab.data, slab.ownAt(rec), rec.own, dim);
    reach = unionInto(slab.data, at, reach, image, 0, kind, dim);
    const images = rec.id !== null && kind !== BOX_NONE ? source.imagesOf?.(rec.id) : null;
    for (const map of images ?? []) {
      if (kind === BOX_ALL) {
        reach = BOX_ALL;
        break;
      }
      const out = new Float64Array(2 * dim);
      map(image, 0, out, 0);
      reach = unionInto(slab.data, at, reach, out, 0, BOX_SOME, dim);
    }
    rec.reach = reach;
    rec.reachTags = rec.tags | tags;
    return reach !== was || rec.reachTags !== wasTags || (reach === BOX_SOME && !sameBox(slab.data, at, scratch, 0, dim));
  }

  function drain(): void {
    for (let d = queue.length - 1; d >= 0; d--) {
      const level = queue[d];
      if (level === undefined) continue;
      for (let i = 0; i < level.length; i++) {
        const rec = level[i]!;
        rec.queued = false;
        if (rec.id !== null && !recs.has(rec.id)) continue;
        if (!recompute(rec) || rec.parent === null) continue;
        rec.parent.wide?.put(rec);
        enqueue(rec.parent);
      }
    }
    queue = [];
  }

  function buildAll(): void {
    builds++;
    totalBuilds++;
    slab = new ReachSlab(dim, Math.max(64, recs.size + 1));
    recs = new Map();
    root = new ReachRec(null, slab.alloc());
    const visit = (rec: ReachRec): void => {
      readOwn(rec);
      for (const k of source.childrenOf(rec.id)) {
        const c = create(k);
        c.parent = rec;
        visit(c);
      }
      recompute(rec);
    };
    visit(root);
  }

  function apply(ids: ReadonlySet<string>, parents: ReadonlySet<string | null>): void {
    for (const p of parents) {
      const rec = recOf(p);
      if (rec === undefined) continue;
      rec.childrenStale = true;
      enqueue(rec);
    }
    // Every id first gets a record, so a node added under another added node finds its parent's.
    const live: ReachRec[] = [];
    for (const id of ids) {
      const parent = source.parentOf(id);
      const rec = recs.get(id);
      if (parent === undefined) {
        if (rec) drop(rec);
        continue;
      }
      live.push(rec ?? create(id));
    }
    for (const rec of live) {
      const parent = recOf(source.parentOf(rec.id!) ?? null) ?? root;
      if (rec.parent !== parent) {
        if (rec.parent) {
          rec.parent.wide?.drop(rec);
          enqueue(rec.parent);
        }
        rec.parent = parent;
      }
      rec.ownStale = true;
      // A record queued at its old depth would drain out of order.
      if (rec.queued) rec.queued = false;
    }
    for (const rec of live) enqueue(rec);
  }

  function ensure(): void {
    if (token === null) {
      token = source.changesSince().token;
      buildAll();
      return;
    }
    const changed = source.changesSince(token);
    token = changed.token;
    if (changed.ids === 'unknown') {
      buildAll();
      return;
    }
    if (changed.ids.size === 0 && changed.parents.size === 0) return;
    apply(changed.ids, changed.parents);
    drain();
  }

  function rankChildren(rec: ReachRec, children: readonly string[]): void {
    for (let i = 0; i < children.length; i++) {
      const c = recs.get(children[i]!);
      if (c) c.rank = i;
    }
    rec.wide!.ranksStale = false;
  }

  function childrenMeeting(parent: string | null, children: readonly string[], q: ReachQuery): readonly string[] {
    const rec = recOf(parent);
    if (rec === undefined) return children;
    const { data } = slab;
    if (rec.wide === null) {
      return children.filter((id) => {
        const c = recs.get(id);
        return c === undefined || boxMeets(c.reach, c.reachTags, data, slab.reachAt(c), dim, q);
      });
    }
    if (rec.wide.ranksStale) rankChildren(rec, children);
    const hits: ReachRec[] = [];
    rec.wide.meeting(q, hits);
    hits.sort((a, b) => a.rank - b.rank);
    return hits.map((h) => h.id!);
  }

  function collect(q: ReachQuery, visit: (id: string) => void): void {
    const walk = (parent: string | null): void => {
      for (const id of childrenMeeting(parent, source.childrenOf(parent), q)) {
        const c = recs.get(id);
        if (c && boxMeets(c.own, c.tags, slab.data, slab.ownAt(c), dim, q)) visit(id);
        walk(id);
      }
    };
    walk(null);
  }

  return {
    ensure,
    invalidate() { token = null; },
    childrenMeeting,
    collect,
    ownOf(id) {
      const rec = recs.get(id);
      return rec && { kind: rec.own, box: slab.data, at: slab.ownAt(rec) };
    },
    stats() {
      let wide = root.wide ? 1 : 0;
      for (const rec of recs.values()) if (rec.wide) wide++;
      return { builds, records: recs.size, wide };
    },
  };
}

export { BOX_ALL, BOX_NONE, BOX_SOME };
