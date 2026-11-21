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
import { ReachBoxes } from './reachBoxes';
import { boxMeets, boxWithin } from './reachRegion';
import type { ReachRec } from './reachRec';
import type { ReachQuery, ReachSource } from './reachTypes';
import type { WideChildren } from './wideChildren';

/** Children past which a container indexes them; below half of it, it stops. */
export const WIDE_AT = 64;

/** A scene's paint or pick boxes kept up to date from its touched-ids feed, answering which nodes meet a view, a
 *  point or a ray without walking the whole scene. Made by `createReachTree`. */
export interface ReachTree {
  /** Bring every box up to date with the scene, and answer true. When only a build from the whole scene would,
   *  and `rebuild` is false, forget every box instead and answer false. */
  ensure(rebuild?: boolean): boolean;
  /** Forget every box: the next {@link ReachTree.ensure} builds from the whole scene. */
  invalidate(): void;
  /** Those of `children`, the children of `parent` (`null` for the roots), whose reach meets `q`, in order. */
  childrenMeeting(parent: string | null, children: readonly string[], q: ReachQuery): readonly string[];
  /** Every node whose own box meets `q`, in tree preorder, until `visit` answers false. */
  collect(q: ReachQuery, visit: (id: string) => boolean | void): void;
  /** How often it built from the whole scene, and how many nodes it holds. */
  stats(): { builds: number; records: number; wide: number };
}

let totalBuilds = 0;

/** How many reach trees have been built from a whole scene, for tests and benches that pin when one rebuilds. */
export function reachTreeBuildCount(): number {
  return totalBuilds;
}

class Tree implements ReachTree {
  private boxes: ReachBoxes;
  private token: number | null = null;
  private builds = 0;

  constructor(private readonly source: ReachSource, private readonly wideAt: number) {
    this.boxes = new ReachBoxes(source, wideAt);
  }

  ensure(rebuild = true): boolean {
    const changed = this.source.changesSince(this.token ?? undefined);
    if (this.token === null || changed.ids === 'unknown') {
      if (!rebuild) {
        this.token = null;
        return false;
      }
      this.token = changed.token;
      this.buildAll();
      return true;
    }
    this.token = changed.token;
    if (changed.ids.size === 0 && changed.parents.size === 0) return true;
    this.apply(changed.ids, changed.parents);
    this.boxes.drain();
    return true;
  }

  invalidate(): void {
    this.token = null;
  }

  private buildAll(): void {
    this.builds++;
    totalBuilds++;
    this.boxes = new ReachBoxes(this.source, this.wideAt, Math.max(64, this.boxes.recs.size + 1));
    this.boxes.build();
  }

  private apply(ids: ReadonlySet<string>, parents: ReadonlySet<string | null>): void {
    const { boxes, source } = this;
    for (const p of parents) {
      const rec = boxes.recOf(p);
      if (rec === undefined) continue;
      rec.childrenStale = true;
      boxes.enqueue(rec);
    }
    // Every id first gets a record, so a node added under another added node finds its parent's.
    const live: ReachRec[] = [];
    for (const id of ids) {
      const parent = source.parentOf(id);
      const rec = boxes.recs.get(id);
      if (parent === undefined) {
        if (rec) boxes.drop(rec);
        continue;
      }
      live.push(rec ?? boxes.create(id));
    }
    const joined = new Map<ReachRec, ReachRec[]>();
    for (const rec of live) {
      const parent = boxes.recOf(source.parentOf(rec.id!) ?? null) ?? boxes.root;
      const joinedNow = rec.parent !== parent;
      if (joinedNow) {
        if (rec.parent) {
          rec.parent.wide?.drop(rec);
          boxes.enqueue(rec.parent);
        }
        rec.parent = parent;
        rec.joined = true;
      }
      // One that joined, or was touched in place under a container whose children changed: it may have moved among them.
      if (joinedNow || parents.has(parent.id)) {
        const list = joined.get(parent);
        if (list) list.push(rec);
        else joined.set(parent, [rec]);
      }
      rec.ownStale = true;
      // A record queued at its old depth would drain out of order.
      if (rec.queued) rec.queued = false;
    }
    for (const [parent, list] of joined) this.rankJoined(parent, list);
    for (const rec of live) boxes.enqueue(rec);
  }

  /** Rank the children that joined or moved within a wide container, when they are all at its end, after the rest;
   *  otherwise it re-ranks whole. A child leaving keeps the others' order, so it needs nothing. */
  private rankJoined(parent: ReachRec, list: readonly ReachRec[]): void {
    if (parent.wide === null || parent.wide.ranksStale || parent.orderMoved) return;
    const kids = this.source.childrenOf(parent.id);
    const tail = new Set(kids.slice(kids.length - list.length));
    if (!list.every((r) => tail.has(r.id!))) {
      parent.orderMoved = true;
      return;
    }
    for (let i = kids.length - list.length; i < kids.length; i++) {
      const c = this.boxes.recs.get(kids[i]!);
      if (c) c.rank = parent.wide.nextRank++;
    }
  }

  private rankChildren(wide: WideChildren, children: readonly string[]): void {
    for (let i = 0; i < children.length; i++) {
      const c = this.boxes.recs.get(children[i]!);
      if (c) c.rank = i;
    }
    wide.ranksStale = false;
    wide.nextRank = children.length;
  }

  childrenMeeting(parent: string | null, children: readonly string[], q: ReachQuery): readonly string[] {
    const { boxes } = this;
    const rec = boxes.recOf(parent);
    if (rec === undefined || children.length === 0) return children;
    const { slab } = boxes;
    const { data, dim } = slab;
    // A container wholly in view: every child that paints a wanted tag meets, and the walk culls the rest by node.
    if (boxWithin(rec.reach, rec.reachTags, data, slab.reachAt(rec), dim, q)) return children;
    if (rec.wide === null) {
      return children.filter((id) => {
        const c = boxes.recs.get(id);
        return c === undefined || boxMeets(c.reach, c.reachTags, data, slab.reachAt(c), dim, q);
      });
    }
    if (rec.wide.ranksStale) this.rankChildren(rec.wide, children);
    const hits: ReachRec[] = [];
    rec.wide.meeting(q, hits);
    hits.sort((a, b) => a.rank - b.rank);
    return hits.map((h) => h.id!);
  }

  collect(q: ReachQuery, visit: (id: string) => boolean | void): void {
    const walk = (parent: string | null): boolean => {
      for (const id of this.childrenMeeting(parent, this.source.childrenOf(parent), q)) {
        const c = this.boxes.recs.get(id);
        const { slab } = this.boxes;
        if (c && boxMeets(c.own, c.tags, slab.data, slab.ownAt(c), slab.dim, q) && visit(id) === false) return false;
        if (!walk(id)) return false;
      }
      return true;
    };
    walk(null);
  }

  stats(): { builds: number; records: number; wide: number } {
    let wide = this.boxes.root.wide ? 1 : 0;
    for (const rec of this.boxes.recs.values()) if (rec.wide) wide++;
    return { builds: this.builds, records: this.boxes.recs.size, wide };
  }
}

/** A reach tree over `source`'s nodes, built on its first {@link ReachTree.ensure}. */
export function createReachTree(source: ReachSource, wideAt = WIDE_AT): ReachTree {
  return new Tree(source, wideAt);
}
