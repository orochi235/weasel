import { anchorAt, locateAnchor, type AnchorSet } from './anchorEdits';
import type { PenAnchor } from './anchors';
import type { Point } from './cubicMath';

/**
 * Collapse the handles of the anchors at `flatIndexes` onto their anchors,
 * leaving sharp corners. A segment whose ends both lose their handles turns
 * straight.
 *
 * Returns false when every handle was already on its anchor. A segment that
 * stays curved because its far end keeps a handle still encodes a control at
 * this end, so it decodes as a handle sitting on the anchor: retracted.
 */
export function retractHandles(set: AnchorSet, flatIndexes: Iterable<number>): boolean {
  let changed = false;
  for (const flat of new Set(flatIndexes)) {
    const a = anchorAt(set, flat);
    if (!a) continue;
    if (a.inHandle) { changed = changed || !same(a.inHandle, a); delete a.inHandle; }
    if (a.outHandle) { changed = changed || !same(a.outHandle, a); delete a.outHandle; }
  }
  return changed;
}

/**
 * Give each anchor at `flatIndexes` two handles of equal length pointing in
 * opposite directions, so the curve passes through it smoothly. The shared
 * direction splits the difference between the two handles' own directions,
 * and the shared length is their mean; an anchor with one handle mirrors it.
 *
 * Skipped: an anchor with no handles, and the ends of an open subpath, which
 * have only one segment to shape. Returns false when nothing changed.
 */
export function makeHandlesSymmetric(set: AnchorSet, flatIndexes: Iterable<number>): boolean {
  let changed = false;
  for (const flat of new Set(flatIndexes)) {
    const loc = locateAnchor(set, flat);
    if (!loc) continue;
    const sub = set.anchors[loc.sub];
    const isEnd = !set.closed[loc.sub] && (loc.idx === 0 || loc.idx === sub.length - 1);
    if (isEnd) continue;
    changed = symmetrize(sub[loc.idx]) || changed;
  }
  return changed;
}

function symmetrize(a: PenAnchor): boolean {
  const out = a.outHandle ? offset(a, a.outHandle) : null;
  // The in-handle turned around, so both vectors point along the outgoing side.
  const inFlipped = a.inHandle ? scale(offset(a, a.inHandle), -1) : null;
  const outLen = out ? Math.hypot(out.x, out.y) : 0;
  const inLen = inFlipped ? Math.hypot(inFlipped.x, inFlipped.y) : 0;
  if (outLen === 0 && inLen === 0) return false;

  let dir: Point;
  let len: number;
  if (outLen > 0 && inLen > 0) {
    const sum = { x: out!.x / outLen + inFlipped!.x / inLen, y: out!.y / outLen + inFlipped!.y / inLen };
    const sumLen = Math.hypot(sum.x, sum.y);
    // Handles pointing the same way leave no bisector; keep the out-handle's line.
    dir = sumLen > 1e-9 ? scale(sum, 1 / sumLen) : scale(out!, 1 / outLen);
    len = (outLen + inLen) / 2;
  } else if (outLen > 0) {
    dir = scale(out!, 1 / outLen);
    len = outLen;
  } else {
    dir = scale(inFlipped!, 1 / inLen);
    len = inLen;
  }
  const nextOut = { x: a.x + dir.x * len, y: a.y + dir.y * len };
  const nextIn = { x: a.x - dir.x * len, y: a.y - dir.y * len };
  if (same(a.outHandle, nextOut) && same(a.inHandle, nextIn)) return false;
  a.outHandle = nextOut;
  a.inHandle = nextIn;
  return true;
}

/**
 * Where a handle lands when dragged toward `to` but held to its current
 * direction from `anchor`: `to` projected onto that ray. The length never
 * goes below zero, so the handle can shrink onto the anchor but not flip
 * through it. A handle already sitting on its anchor has no direction to
 * keep and follows `to` freely.
 */
export function handleAlongItsAngle(anchor: Point, handle: Point, to: Point): Point {
  const d = offset(anchor, handle);
  const len = Math.hypot(d.x, d.y);
  if (len === 0) return { x: to.x, y: to.y };
  const ux = d.x / len;
  const uy = d.y / len;
  const along = Math.max(0, (to.x - anchor.x) * ux + (to.y - anchor.y) * uy);
  return { x: anchor.x + ux * along, y: anchor.y + uy * along };
}

/**
 * Where a handle lands when dragged toward `to` but held to its current
 * length from `anchor`: on the circle of that length, aimed at `to`. A `to`
 * on the anchor itself gives no direction, and leaves the handle where it is.
 */
export function handleAtItsLength(anchor: Point, handle: Point, to: Point): Point {
  const len = Math.hypot(handle.x - anchor.x, handle.y - anchor.y);
  const d = offset(anchor, to);
  const dl = Math.hypot(d.x, d.y);
  if (dl === 0) return { x: handle.x, y: handle.y };
  return { x: anchor.x + (d.x / dl) * len, y: anchor.y + (d.y / dl) * len };
}

function offset(from: Point, to: Point): Point {
  return { x: to.x - from.x, y: to.y - from.y };
}

function scale(p: Point, k: number): Point {
  return { x: p.x * k, y: p.y * k };
}

function same(p: Point | undefined, q: Point): boolean {
  return !!p && Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;
}
