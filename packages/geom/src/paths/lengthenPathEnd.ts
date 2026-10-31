/**
 * Grow or trim an open subpath at one of its ends. Lengthen drags this, and
 * Extend to next path reaches it through `lengthenOpenEnd`.
 *
 * A positive distance extends the end outward along the curve its mode draws
 * (`extensionPieces`): straight along the end tangent, along a circular arc
 * with the curvature the end has, or easing out of that curvature into a
 * straight run. A straight end segment lengthened straight grows in place;
 * anything else is continued with new segments. A negative distance trims the
 * path back along itself by arc length, whichever way it would have grown.
 *
 * The arc rather than extrapolating the end cubic past t = 1: a cubic's
 * leading term takes over beyond its range, so a continued curve swings off
 * and curls on itself within a segment's length, while the arc keeps the
 * curvature the end shows for as long as it is drawn.
 */

import type { AnchorSet } from './anchorEdits';
import { flatAnchorIndex, locateAnchor } from './anchorEdits';
import { isStraightSegment, type PenAnchor } from './anchors';
import { splitCubicAtT, type Point } from './cubicMath';
import { cubicCurvatureAt, cubicDerivativeAt } from './curvature';
import type { OpenPathEnd } from './extendPath';
import { nearestOnCubic, nearestOnLine } from '../nearest';
import {
  easeLength, extensionPieces, pieceLengthAt, type EaseOptions, type LengthenMode, type PathEndFrame,
} from './pathEndExtension';
import { segmentLength, segmentTAtLength } from './segmentLength';

export type { EaseOptions, LengthenMode, PathEndFrame } from './pathEndExtension';

/** The share of a subpath's length a trim always leaves. */
const MIN_KEEP = 1e-3;
const FULL = 2 * Math.PI;

/** The end of an open subpath that the anchor at `flatIndex` is, or null when it is
 *  an inner anchor, on a closed subpath, or alone in its subpath. */
export function openEndAt(set: AnchorSet, flatIndex: number): OpenPathEnd | null {
  const loc = locateAnchor(set, flatIndex);
  if (!loc || set.closed[loc.sub]) return null;
  const len = set.anchors[loc.sub].length;
  if (len < 2) return null;
  if (loc.idx === 0) return { sub: loc.sub, end: 'first' };
  if (loc.idx === len - 1) return { sub: loc.sub, end: 'last' };
  return null;
}

/** Flat index of the anchor at `end`, or -1 when there is none. */
export function pathEndAnchorIndex(set: AnchorSet, end: OpenPathEnd): number {
  const sub = set.anchors[end.sub];
  if (!sub) return -1;
  return flatAnchorIndex(set, end.sub, end.end === 'first' ? 0 : sub.length - 1);
}

/** The frame at `end`, or null when it is not the end of an open subpath of two or
 *  more anchors, or the path has no direction there. */
export function pathEndFrame(set: AnchorSet, end: OpenPathEnd): PathEndFrame | null {
  return atTail(set, end, tailFrame) ?? null;
}

/**
 * Lengthen `end` by `distance` (see the module comment), in place. A curvature arc
 * stops at one full turn. Returns false when `end` is not the end of an open
 * subpath or nothing changed.
 */
export function lengthenPathEnd(
  set: AnchorSet, end: OpenPathEnd, distance: number, mode: LengthenMode, opts: EaseOptions = {},
): boolean {
  if (!(distance !== 0 && Number.isFinite(distance))) return false;
  return atTail(set, end, (sub) => (distance < 0 ? trimTail(sub, -distance) : growTail(sub, distance, mode, opts))) ?? false;
}

/**
 * The distance `lengthenPathEnd` takes for its new end to land nearest `point`: the
 * point projected onto the end tangent, for a curvature lengthening measured
 * around the circle of curvature, and for an eased one along the eased curve
 * where the point is ahead of the end. A measurement around the circle can name
 * the same spot a turn apart; it answers the one nearest `near`, so a drag
 * passing half a turn keeps going instead of jumping back.
 */
export function lengthToward(
  set: AnchorSet,
  end: OpenPathEnd,
  mode: LengthenMode,
  point: Point,
  near = 0,
  opts: EaseOptions = {},
): number {
  const frame = pathEndFrame(set, end);
  if (!frame) return 0;
  const { point: p, tangent: t, curvature } = frame;
  const vx = point.x - p.x;
  const vy = point.y - p.y;
  const ahead = vx * t.x + vy * t.y;
  if (mode === 'tangent' || curvature === 0 || (mode === 'eased' && ahead <= 0)) return ahead;
  if (mode === 'eased') return lengthAlongEased(frame, point, opts);
  const s = Math.sign(curvature);
  const r = 1 / Math.abs(curvature);
  const c = arcCenter(frame);
  const ax = p.x - c.x, ay = p.y - c.y;
  const bx = point.x - c.x, by = point.y - c.y;
  const angle = s * Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
  const turns = Math.round((near / r - angle) / FULL);
  return (angle + turns * FULL) * r;
}

/** Run `edit` on the subpath with `end` as its last anchor, reversing it around
 *  the edit for a start. Undefined when `end` is not the end of an open subpath. */
function atTail<R>(set: AnchorSet, end: OpenPathEnd, edit: (sub: PenAnchor[]) => R): R | undefined {
  const sub = set.anchors[end.sub];
  if (!sub || set.closed[end.sub] || sub.length < 2) return undefined;
  if (end.end === 'last') return edit(sub);
  reverseInPlace(sub);
  try {
    return edit(sub);
  } finally {
    reverseInPlace(sub);
  }
}

/** Reverse a subpath's direction, keeping each anchor object. */
function reverseInPlace(sub: PenAnchor[]): void {
  sub.reverse();
  for (const a of sub) {
    const { inHandle, outHandle } = a;
    if (outHandle) a.inHandle = outHandle;
    else delete a.inHandle;
    if (inHandle) a.outHandle = inHandle;
    else delete a.outHandle;
  }
}

/** The last segment's four control points, its own handles where it has them. */
function tailCubic(sub: readonly PenAnchor[]): [PenAnchor, Point, Point, PenAnchor] {
  const a = sub[sub.length - 2];
  const b = sub[sub.length - 1];
  return [a, a.outHandle ?? a, b.inHandle ?? b, b];
}

function tailFrame(sub: readonly PenAnchor[]): PathEndFrame | null {
  const [p0, p1, p2, p3] = tailCubic(sub);
  const point = { x: p3.x, y: p3.y };
  if (isStraightSegment(p0, p3)) return frameHeading(point, p3.x - p0.x, p3.y - p0.y, 0);
  const d1 = cubicDerivativeAt(p0, p1, p2, p3, 1);
  if (Math.hypot(d1.x, d1.y) > 1e-9) return frameHeading(point, d1.x, d1.y, cubicCurvatureAt(p0, p1, p2, p3, 1));
  // The near control sits on the end, which leaves no velocity there to read
  // the bend from: head along the next control that does not.
  const from = Math.hypot(p3.x - p1.x, p3.y - p1.y) > 1e-9 ? p1 : p0;
  return frameHeading(point, p3.x - from.x, p3.y - from.y, 0);
}

function frameHeading(point: Point, dx: number, dy: number, curvature: number): PathEndFrame | null {
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-9)) return null;
  return { point, tangent: { x: dx / len, y: dy / len }, curvature };
}

function arcCenter({ point, tangent, curvature }: PathEndFrame): Point {
  return { x: point.x - tangent.y / curvature, y: point.y + tangent.x / curvature };
}

/** The arc length along `frame`'s eased extension to the point of it nearest
 *  `point`, searching as far past the ease as `point` is from the end. */
function lengthAlongEased(frame: PathEndFrame, point: Point, opts: EaseOptions): number {
  const far = Math.hypot(point.x - frame.point.x, point.y - frame.point.y);
  const reach = Math.min(easeLength(frame, opts), far * 2) + far;
  let best = { dist: Infinity, length: 0 };
  let walked = 0;
  for (const piece of extensionPieces(frame, reach, 'eased', opts)) {
    const [q0, q1, q2, q3] = piece.pts;
    const hit = piece.pts.length === 2
      ? nearestOnLine(point.x, point.y, q0.x, q0.y, q1.x, q1.y)
      : nearestOnCubic(point.x, point.y, q0.x, q0.y, q1.x, q1.y, q2.x, q2.y, q3.x, q3.y);
    if (hit.dist < best.dist) best = { dist: hit.dist, length: walked + pieceLengthAt(piece, hit.t) };
    walked += piece.length;
  }
  return best.length;
}

function growTail(sub: PenAnchor[], distance: number, mode: LengthenMode, opts: EaseOptions): boolean {
  const frame = tailFrame(sub);
  if (!frame) return false;
  const pieces = extensionPieces(frame, distance, mode, opts);
  const end = sub[sub.length - 1];
  const first = pieces[0];
  if (pieces.length === 1 && first.pts.length === 2 && isStraightSegment(sub[sub.length - 2], end)) {
    end.x = first.pts[1].x;
    end.y = first.pts[1].y;
    return true;
  }
  appendPieces(sub, pieces);
  return pieces.length > 0;
}

/** Append `pieces` to the subpath, each starting where it ends. */
function appendPieces(sub: PenAnchor[], pieces: readonly { pts: Point[] }[]): void {
  let prev = sub[sub.length - 1];
  for (const { pts } of pieces) {
    const to = pts[pts.length - 1];
    const next: PenAnchor = { x: to.x, y: to.y };
    if (pts.length === 4) {
      prev.outHandle = { ...pts[1] };
      next.inHandle = { ...pts[2] };
    }
    sub.push(next);
    prev = next;
  }
}

function tailLength(sub: readonly PenAnchor[]): number {
  const [p0, p1, p2, p3] = tailCubic(sub);
  if (isStraightSegment(p0, p3)) return Math.hypot(p3.x - p0.x, p3.y - p0.y);
  return segmentLength([p0, p1, p2, p3]);
}

function subpathLength(sub: readonly PenAnchor[]): number {
  let total = 0;
  for (let n = 2; n <= sub.length; n++) total += tailLength(sub.slice(n - 2, n));
  return total;
}

/** Cut `amount` of arc length off the subpath's end, dropping each anchor the cut
 *  passes, and always leaving some of the subpath. */
function trimTail(sub: PenAnchor[], amount: number): boolean {
  const total = subpathLength(sub);
  if (!(total > 0)) return false;
  let left = Math.min(amount, total * (1 - MIN_KEEP));
  for (;;) {
    const len = tailLength(sub);
    if (left < len || sub.length === 2) {
      cutTail(sub, Math.max(0, len - left), len);
      return true;
    }
    left -= len;
    sub.pop();
    delete sub[sub.length - 1].outHandle;
  }
}

/** Shorten the last segment to its first `keep` of `len`. */
function cutTail(sub: PenAnchor[], keep: number, len: number): void {
  const [p0, p1, p2, p3] = tailCubic(sub);
  if (isStraightSegment(p0, p3)) {
    const f = len > 0 ? keep / len : 0;
    p3.x = p0.x + (p3.x - p0.x) * f;
    p3.y = p0.y + (p3.y - p0.y) * f;
    return;
  }
  const t = segmentTAtLength([p0, p1, p2, p3], keep);
  const { left } = splitCubicAtT(p0, p1, p2, p3, t);
  if (p0.outHandle) p0.outHandle = left[1];
  p3.inHandle = left[2];
  p3.x = left[3].x;
  p3.y = left[3].y;
}
