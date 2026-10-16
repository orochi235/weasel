/**
 * Grow or trim an open subpath at one of its ends. Lengthen drags this, and
 * Extend to next path reaches it through `lengthenOpenEnd`.
 *
 * A positive distance extends the end outward: straight along the end tangent,
 * or along a circular arc with the curvature the end has, which meets the path
 * with matching direction and curvature. A straight end segment is lengthened
 * in place; a curved one is continued with a new segment. A negative distance
 * trims the path back along itself by arc length, whichever way it would have
 * grown.
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
import { segmentLength, segmentTAtLength } from './segmentLength';

/** How `lengthenPathEnd` grows an end: straight on, or bending as the end bends. */
export type LengthenMode = 'tangent' | 'curvature';

/** Where an end is, which way it heads out of the path, and how it bends there. */
export interface PathEndFrame {
  point: Point;
  /** Unit vector pointing out of the path. */
  tangent: Point;
  /** Signed curvature along `tangent`: positive turns toward `(-tangent.y, tangent.x)`. */
  curvature: number;
}

/** Below this turn over the requested length an arc is drawn as a straight run. */
const STRAIGHT_TURN = 1e-6;
/** The share of a subpath's length a trim always leaves. */
const MIN_KEEP = 1e-3;
const QUARTER = Math.PI / 2;
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
export function lengthenPathEnd(set: AnchorSet, end: OpenPathEnd, distance: number, mode: LengthenMode): boolean {
  if (!(distance !== 0 && Number.isFinite(distance))) return false;
  return atTail(set, end, (sub) => (distance < 0 ? trimTail(sub, -distance) : growTail(sub, distance, mode))) ?? false;
}

/**
 * The distance `lengthenPathEnd` takes for its new end to land nearest `point`: the
 * point projected onto the end tangent, or for a curvature lengthening, measured
 * around the circle of curvature. A measurement around the circle can name the
 * same spot a turn apart; it answers the one nearest `near`, so a drag passing
 * half a turn keeps going instead of jumping back.
 */
export function lengthToward(
  set: AnchorSet,
  end: OpenPathEnd,
  mode: LengthenMode,
  point: Point,
  near = 0,
): number {
  const frame = pathEndFrame(set, end);
  if (!frame) return 0;
  const { point: p, tangent: t, curvature } = frame;
  const vx = point.x - p.x;
  const vy = point.y - p.y;
  if (mode === 'tangent' || curvature === 0) return vx * t.x + vy * t.y;
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

function growTail(sub: PenAnchor[], distance: number, mode: LengthenMode): boolean {
  const frame = tailFrame(sub);
  if (!frame) return false;
  if (mode === 'curvature' && Math.abs(frame.curvature) * distance > STRAIGHT_TURN) {
    appendArc(sub, frame, distance);
    return true;
  }
  const to = { x: frame.point.x + frame.tangent.x * distance, y: frame.point.y + frame.tangent.y * distance };
  const end = sub[sub.length - 1];
  if (isStraightSegment(sub[sub.length - 2], end)) {
    end.x = to.x;
    end.y = to.y;
  } else {
    sub.push(to);
  }
  return true;
}

/** Continue the subpath along the circle of curvature at its end, one cubic per
 *  quarter turn or less. */
function appendArc(sub: PenAnchor[], frame: PathEndFrame, distance: number): void {
  const s = Math.sign(frame.curvature);
  const r = 1 / Math.abs(frame.curvature);
  const sweep = Math.min(distance / r, FULL);
  const pieces = Math.max(1, Math.ceil(sweep / QUARTER - 1e-9));
  const step = sweep / pieces;
  const reach = (4 / 3) * Math.tan(step / 4) * r;
  const c = arcCenter(frame);
  const rx = frame.point.x - c.x;
  const ry = frame.point.y - c.y;
  const at = (turn: number) => {
    const cos = Math.cos(s * turn);
    const sin = Math.sin(s * turn);
    return {
      p: { x: c.x + rx * cos - ry * sin, y: c.y + rx * sin + ry * cos },
      t: { x: frame.tangent.x * cos - frame.tangent.y * sin, y: frame.tangent.x * sin + frame.tangent.y * cos },
    };
  };
  let prev = sub[sub.length - 1];
  for (let i = 1; i <= pieces; i++) {
    const from = at((i - 1) * step);
    const to = at(i * step);
    prev.outHandle = { x: from.p.x + from.t.x * reach, y: from.p.y + from.t.y * reach };
    const next: PenAnchor = { x: to.p.x, y: to.p.y, inHandle: { x: to.p.x - to.t.x * reach, y: to.p.y - to.t.y * reach } };
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
