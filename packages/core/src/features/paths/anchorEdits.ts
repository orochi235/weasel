/**
 * Pure anchor-set edits — the geometry half of path editing, with no
 * dependency on any tool's scratch or on the action layer.
 *
 * The model is the one `pathToAnchors` produces: subpath-major
 * `PenAnchor[][]` plus a parallel `closed: boolean[]`. Every function here
 * mutates that structure in place; callers decode with `pathToAnchors`,
 * apply, and re-encode with `anchorsToPath` (see {@link editAnchorSet}).
 *
 * ## Two ways to name an anchor
 *
 * Callers address anchors by **flat index** — the sequential position in
 * walk order across all subpaths, which is exactly what
 * `enumerateAnchors` reports and therefore what the dispatcher's
 * `anchor:N` / `controlIn:N` / `controlOut:N` affordance kinds carry.
 * Internally, operations that have to reason about subpath structure
 * (deletion, scissors) need the `(sub, idx)` pair instead.
 * {@link locateAnchor} and {@link flatAnchorIndex} convert.
 *
 * The two orders agree because `pathToAnchors` and `enumerateAnchors`
 * walk the same command stream and emit one anchor per M/L/C/Q — see the
 * invariant test in `anchorEdits.test.ts`. If you change either walker,
 * that test is the tripwire.
 */

import { cubicPointAt, fitCubicThroughDeletion, splitCubicAtT } from './cubicMath';
import {
  pathToAnchors,
  anchorsToPath,
  isAnchorSmooth,
  isStraightSegment,
  nearestSegmentT,
  segmentEnds,
  type PenAnchor,
} from './anchors';
import { withinPxRadius, type Scale2 } from 'core/viewport/pxExtent';
import type { PolygonPath } from './types';

/** Subpath-major anchor model — the decoded form of a `PolygonPath`. */
export interface AnchorSet {
  anchors: PenAnchor[][];
  closed: boolean[];
}

/** A world-space rectangle, as produced by a drag-rect gesture. */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Addressing
// ---------------------------------------------------------------------------

/** Total anchors across every subpath. */
export function anchorCount(set: AnchorSet): number {
  let n = 0;
  for (const sub of set.anchors) n += sub.length;
  return n;
}

/** Flat index → `(sub, idx)`. Returns null when out of range. */
export function locateAnchor(
  set: AnchorSet,
  flatIndex: number,
): { sub: number; idx: number } | null {
  if (flatIndex < 0) return null;
  let remaining = flatIndex;
  for (let sub = 0; sub < set.anchors.length; sub++) {
    const len = set.anchors[sub].length;
    if (remaining < len) return { sub, idx: remaining };
    remaining -= len;
  }
  return null;
}

/** `(sub, idx)` → flat index. Returns -1 when out of range. */
export function flatAnchorIndex(set: AnchorSet, sub: number, idx: number): number {
  if (sub < 0 || sub >= set.anchors.length) return -1;
  if (idx < 0 || idx >= set.anchors[sub].length) return -1;
  let base = 0;
  for (let s = 0; s < sub; s++) base += set.anchors[s].length;
  return base + idx;
}

/** Resolve a flat index to the anchor itself. Null when out of range. */
export function anchorAt(set: AnchorSet, flatIndex: number): PenAnchor | null {
  const loc = locateAnchor(set, flatIndex);
  if (!loc) return null;
  return set.anchors[loc.sub][loc.idx] ?? null;
}

// ---------------------------------------------------------------------------
// Decode / apply / encode
// ---------------------------------------------------------------------------

/**
 * Decode `path`, hand the mutable anchor set to `edit`, and re-encode.
 * Returns the new path, or null when `edit` reports that it changed
 * nothing (returning `false`) — callers use that to skip a no-op commit
 * and avoid pushing an empty history entry.
 */
export function editAnchorSet(
  path: PolygonPath,
  edit: (set: AnchorSet) => boolean | void,
): PolygonPath | null {
  const set = pathToAnchors(path) as AnchorSet;
  const changed = edit(set);
  if (changed === false) return null;
  return anchorsToPath(set.anchors, set.closed);
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

/** Translate an anchor and both of its handles by `(dx, dy)`. */
export function translateAnchorBy(
  set: AnchorSet,
  flatIndex: number,
  dx: number,
  dy: number,
): boolean {
  const a = anchorAt(set, flatIndex);
  if (!a) return false;
  a.x += dx;
  a.y += dy;
  if (a.inHandle) {
    a.inHandle.x += dx;
    a.inHandle.y += dy;
  }
  if (a.outHandle) {
    a.outHandle.x += dx;
    a.outHandle.y += dy;
  }
  return true;
}

/**
 * Move one control handle to an absolute world position.
 *
 * When the anchor was smooth (handles collinear through the anchor) and
 * `breakSmoothness` is false, the opposite handle is mirrored so the curve
 * stays smooth — Illustrator's default. Alt-drag sets `breakSmoothness`
 * and the two handles become independent.
 */
export function moveHandleTo(
  set: AnchorSet,
  flatIndex: number,
  side: 'in' | 'out',
  toX: number,
  toY: number,
  breakSmoothness: boolean,
): boolean {
  const a = anchorAt(set, flatIndex);
  if (!a) return false;
  const wasSmooth = isAnchorSmooth(a);
  const target = { x: toX, y: toY };
  if (side === 'out') a.outHandle = target;
  else a.inHandle = target;
  const oppositeSide = side === 'out' ? 'in' : 'out';
  const opposite = oppositeSide === 'in' ? a.inHandle : a.outHandle;
  if (!breakSmoothness && wasSmooth && opposite) {
    const mirrored = { x: 2 * a.x - target.x, y: 2 * a.y - target.y };
    if (oppositeSide === 'in') a.inHandle = mirrored;
    else a.outHandle = mirrored;
  }
  return true;
}

/**
 * Split the segment `(sub, segIdx) → (sub, segIdx + 1)` at parameter `t`,
 * inserting a new anchor there. On a closed subpath `segIdx` may also name
 * the closing segment (`sub.length - 1`); its new anchor is appended.
 *
 * A straight segment splits linearly and stays straight — the new anchor
 * has no handles. A curved one splits by de Casteljau, which preserves the
 * curve exactly: the two halves trace the original path.
 *
 * Returns the new anchor's flat index, or -1 when the segment doesn't
 * exist.
 */
export function insertAnchorOnSegment(
  set: AnchorSet,
  args: { sub: number; segIdx: number; t: number },
): number {
  const ends = segmentEnds(set.anchors, set.closed, args.sub, args.segIdx);
  if (!ends) return -1;
  const { a, b } = ends;
  const at = args.segIdx + 1;
  if (isStraightSegment(a, b)) {
    set.anchors[args.sub].splice(at, 0, {
      x: a.x + (b.x - a.x) * args.t,
      y: a.y + (b.y - a.y) * args.t,
    });
    return flatAnchorIndex(set, args.sub, at);
  }
  const p0 = a, p1 = a.outHandle ?? a, p2 = b.inHandle ?? b, p3 = b;
  const { left, right } = splitCubicAtT(p0, p1, p2, p3, args.t);
  a.outHandle = { x: left[1].x, y: left[1].y };
  b.inHandle = { x: right[2].x, y: right[2].y };
  set.anchors[args.sub].splice(at, 0, {
    x: left[3].x,
    y: left[3].y,
    inHandle: { x: left[2].x, y: left[2].y },
    outHandle: { x: right[1].x, y: right[1].y },
  });
  return flatAnchorIndex(set, args.sub, at);
}

/** A point on a segment, as {@link segmentAt} reports it. */
export interface SegmentHit {
  sub: number;
  segIdx: number;
  /** Parameter on the segment — what {@link insertAnchorOnSegment} takes. */
  t: number;
  /** The point on the path at `t`, in the set's own space. */
  x: number;
  y: number;
}

/**
 * The segment point under `(x, y)`, when it lies within `tolerancePx` of
 * the path on screen and no nearer than that to either of the segment's
 * own anchors — a press on an anchor is about the anchor, not the segment
 * beside it.
 *
 * `scale` is the view's, so the tolerance holds per axis under
 * non-uniform zoom. The search runs in screen-scaled space: scaling is
 * affine, so the curve's parameterization, and therefore `t`, carries
 * straight back to world space.
 */
export function segmentAt(
  set: AnchorSet,
  x: number,
  y: number,
  opts: { tolerancePx: number; scale?: Scale2 },
): SegmentHit | null {
  const scale = opts.scale ?? { x: 1, y: 1 };
  const onScreen = (p: { x: number; y: number }) => ({ x: p.x * scale.x, y: p.y * scale.y });
  const screenAnchors = set.anchors.map((sub) => sub.map((a) => ({
    ...onScreen(a),
    ...(a.inHandle ? { inHandle: onScreen(a.inHandle) } : {}),
    ...(a.outHandle ? { outHandle: onScreen(a.outHandle) } : {}),
  })));
  const hit = nearestSegmentT(screenAnchors, x * scale.x, y * scale.y, set.closed);
  if (!hit) return null;
  const ends = segmentEnds(set.anchors, set.closed, hit.sub, hit.segIdx)!;
  const point = pointOnSegment(ends.a, ends.b, hit.t);
  const tol = opts.tolerancePx;
  if (!withinPxRadius(point.x - x, point.y - y, tol, scale)) return null;
  if (withinPxRadius(point.x - ends.a.x, point.y - ends.a.y, tol, scale)) return null;
  if (withinPxRadius(point.x - ends.b.x, point.y - ends.b.y, tol, scale)) return null;
  return { sub: hit.sub, segIdx: hit.segIdx, t: hit.t, x: point.x, y: point.y };
}

function pointOnSegment(a: PenAnchor, b: PenAnchor, t: number): { x: number; y: number } {
  if (isStraightSegment(a, b)) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  return cubicPointAt(a, a.outHandle ?? a, b.inHandle ?? b, b, t);
}

/**
 * Delete the anchors at `flatIndexes`. Where a deleted anchor had
 * neighbors on both sides, the surviving segment is refitted through the
 * gap (`fitCubicThroughDeletion`) so the path keeps its shape instead of
 * snapping to a straight line.
 *
 * Subpaths left with fewer than two anchors are dropped entirely — a
 * one-anchor subpath has no segments and would serialize to a stray `M`.
 *
 * If that would leave the path with **no** subpaths at all, the whole
 * deletion is refused (returns false, `set` untouched). Committing an
 * empty path turns the node into an invisible zombie: still selected,
 * still in the scene, nothing on screen and no anchors left to grab it
 * by. Deleting the object is the node-level Delete action's job, and the
 * user asked to delete anchors.
 */
export function deleteAnchorsAt(set: AnchorSet, flatIndexes: Iterable<number>): boolean {
  const bySub = new Map<number, number[]>();
  for (const flat of flatIndexes) {
    const loc = locateAnchor(set, flat);
    if (!loc) continue;
    const list = bySub.get(loc.sub);
    if (list) list.push(loc.idx);
    else bySub.set(loc.sub, [loc.idx]);
  }
  if (bySub.size === 0) return false;

  // Refuse up front if this would wipe the path out — cheaper and safer
  // than mutating and rolling back.
  let survivors = 0;
  for (let s = 0; s < set.anchors.length; s++) {
    const doomed = bySub.get(s)?.length ?? 0;
    if (set.anchors[s].length - doomed >= 2) survivors++;
  }
  if (survivors === 0) return false;

  for (const [s, indices] of bySub) {
    const sub = set.anchors[s];
    if (!sub) continue;
    // Descending so each splice leaves the not-yet-processed indices valid.
    indices.sort((a, b) => b - a);
    for (const i of indices) {
      const prev = sub[i - 1];
      const next = sub[i + 1];
      if (prev && next) {
        const { c1, c2 } = fitCubicThroughDeletion(prev, next);
        prev.outHandle = c1;
        next.inHandle = c2;
      }
      sub.splice(i, 1);
    }
  }

  // Drop degenerate subpaths, back to front so indices stay valid.
  for (let s = set.anchors.length - 1; s >= 0; s--) {
    if (set.anchors[s].length < 2) {
      set.anchors.splice(s, 1);
      set.closed.splice(s, 1);
    }
  }
  return true;
}

/**
 * Scissors: open a closed subpath at the given anchor, rotating the
 * anchor list so the cut point becomes the new start/end. No-ops on an
 * already-open subpath — there's nothing to cut.
 */
export function openSubpathAt(set: AnchorSet, flatIndex: number): boolean {
  const loc = locateAnchor(set, flatIndex);
  if (!loc) return false;
  if (!set.closed[loc.sub]) return false;
  const sub = set.anchors[loc.sub];
  if (!sub) return false;
  set.anchors[loc.sub] = [...sub.slice(loc.idx), ...sub.slice(0, loc.idx)];
  set.closed[loc.sub] = false;
  return true;
}

/** Flat indices of every anchor whose on-curve point falls inside `rect`. */
export function anchorsInRect(set: AnchorSet, rect: AnchorRect): number[] {
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;
  const hits: number[] = [];
  let flat = 0;
  for (const sub of set.anchors) {
    for (const a of sub) {
      if (a.x >= rect.x && a.x <= x2 && a.y >= rect.y && a.y <= y2) hits.push(flat);
      flat++;
    }
  }
  return hits;
}
