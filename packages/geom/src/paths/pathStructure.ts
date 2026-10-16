/**
 * Edits to a path's order rather than its shape: where a subpath starts, and
 * which way it runs. Each mutates an `AnchorSet` in place, like the edits in
 * `anchorEdits`, and moves anchors whole, so anything an anchor carries beside
 * its point and handles travels with it.
 */

import { locateAnchor, type AnchorSet } from './anchorEdits';
import { cubicPointAt } from './cubicMath';
import { isStraightSegment, segmentEnds } from './anchors';
import { reverseAnchors } from './nearestAnchor';

/**
 * Make the anchor at `flatIndex` its subpath's first. A closed subpath turns
 * so it starts there, keeping its direction. An open subpath can only start
 * at one of its ends: its last anchor makes it run the other way, and an
 * interior anchor changes nothing. Returns whether the set changed.
 */
export function setSubpathStart(set: AnchorSet, flatIndex: number): boolean {
  const loc = locateAnchor(set, flatIndex);
  if (!loc || loc.idx === 0) return false;
  const sub = set.anchors[loc.sub];
  if (set.closed[loc.sub]) {
    set.anchors[loc.sub] = [...sub.slice(loc.idx), ...sub.slice(0, loc.idx)];
    return true;
  }
  if (loc.idx !== sub.length - 1) return false;
  set.anchors[loc.sub] = reverseAnchors(sub);
  return true;
}

/**
 * Run each subpath in `subs` the other way, every one when `subs` is absent.
 * The shape is unchanged: each anchor's handles trade places. A closed
 * subpath keeps its start anchor, as `reversePath` does; an open one starts
 * where it used to end. Returns whether any subpath had a segment to turn.
 */
export function reverseSubpaths(set: AnchorSet, subs?: Iterable<number>): boolean {
  const which = subs ? new Set(subs) : set.anchors.map((_, s) => s);
  let changed = false;
  for (const s of which) {
    const sub = set.anchors[s];
    if (!sub || sub.length < 2) continue;
    const back = reverseAnchors(sub);
    // `reverseAnchors` ends on the old start; a closed subpath turns it back to the front.
    set.anchors[s] = set.closed[s] ? [back[back.length - 1], ...back.slice(0, -1)] : back;
    changed = true;
  }
  return changed;
}

/**
 * Where each anchor at `flatIndexes` sits once `reverseSubpaths(set, subs)`
 * has run: an anchor keeps its point, so a selection can follow it. Indexes
 * outside the set are dropped.
 */
export function flatIndexesAfterReverse(
  set: AnchorSet,
  flatIndexes: Iterable<number>,
  subs?: Iterable<number>,
): number[] {
  const which = subs ? new Set(subs) : null;
  const out: number[] = [];
  for (const flat of flatIndexes) {
    const loc = locateAnchor(set, flat);
    if (!loc) continue;
    const n = set.anchors[loc.sub].length;
    if (which && !which.has(loc.sub)) { out.push(flat); continue; }
    const idx = set.closed[loc.sub] ? (n - loc.idx) % n : n - 1 - loc.idx;
    out.push(flat - loc.idx + idx);
  }
  return out;
}

/** The subpaths holding the anchors at `flatIndexes`, each once, in order. */
export function subpathsOfAnchors(set: AnchorSet, flatIndexes: Iterable<number>): number[] {
  const subs = new Set<number>();
  for (const flat of flatIndexes) {
    const loc = locateAnchor(set, flat);
    if (loc) subs.add(loc.sub);
  }
  return [...subs].sort((a, b) => a - b);
}

/** A mark showing which way a path runs: a point on it and the unit vector of its heading there. */
export interface DirectionMark {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** The subpath the mark is on. */
  sub: number;
}

/**
 * One {@link DirectionMark} at the middle of every segment of `set`, closing
 * segments included, in walk order. A segment with no length gets none.
 */
export function directionMarks(set: AnchorSet): DirectionMark[] {
  const out: DirectionMark[] = [];
  set.anchors.forEach((sub, s) => {
    const count = set.closed[s] ? sub.length : sub.length - 1;
    for (let i = 0; i < count; i++) {
      const ends = segmentEnds(set.anchors, set.closed, s, i);
      if (!ends) continue;
      const mark = midMark(ends.a, ends.b);
      if (mark) out.push({ ...mark, sub: s });
    }
  });
  return out;
}

type Point = { x: number; y: number };

function midMark(a: Point & { outHandle?: Point }, b: Point & { inHandle?: Point }): Omit<DirectionMark, 'sub'> | null {
  if (isStraightSegment(a, b)) return unit({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b.x - a.x, b.y - a.y);
  const c1 = a.outHandle ?? a;
  const c2 = b.inHandle ?? b;
  const mid = cubicPointAt(a, c1, c2, b, 0.5);
  // The cubic's derivative at t = 1/2, up to a constant factor.
  const dx = (c2.x + b.x) - (a.x + c1.x);
  const dy = (c2.y + b.y) - (a.y + c1.y);
  return unit(mid, dx, dy) ?? unit(mid, b.x - a.x, b.y - a.y);
}

function unit(at: Point, dx: number, dy: number): Omit<DirectionMark, 'sub'> | null {
  const len = Math.hypot(dx, dy);
  return len > 1e-9 ? { x: at.x, y: at.y, dx: dx / len, dy: dy / len } : null;
}
