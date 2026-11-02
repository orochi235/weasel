import type { AnchorSet } from './anchorEdits';
import { isAnchorSmooth, isStraightSegment, segmentEnds, type PenAnchor } from './anchors';
import { lerpPoint } from '../points2';

/** Where on a segment a bend is held, as `segmentAt` reports it. */
export interface BendGrip {
  sub: number;
  segIdx: number;
  /** Curve parameter of the held point. */
  t: number;
}

/** The held point's parameter is kept this far from either end, where moving
 *  it by a pixel would throw a handle out by hundreds. */
const T_MARGIN = 0.05;

/**
 * Bend one segment so the point held at `grip.t` moves by `(dx, dy)`, by
 * moving its two control handles: each by an amount weighted toward the end it
 * belongs to, together exactly enough to carry the held point along. A straight
 * segment becomes a curve. Where an end anchor was smooth, its other handle
 * turns to stay in line, keeping its length, so the neighboring segment bends
 * with it rather than kinking.
 *
 * Returns false when the segment doesn't exist.
 */
export function bendSegment(set: AnchorSet, grip: BendGrip, dx: number, dy: number): boolean {
  const ends = segmentEnds(set.anchors, set.closed, grip.sub, grip.segIdx);
  if (!ends) return false;
  const { a, b } = ends;
  const aSmooth = isAnchorSmooth(a);
  const bSmooth = isAnchorSmooth(b);
  const straight = isStraightSegment(a, b);
  const p1 = a.outHandle ?? (straight ? lerpPoint(a, b, 1 / 3) : { x: a.x, y: a.y });
  const p2 = b.inHandle ?? (straight ? lerpPoint(a, b, 2 / 3) : { x: b.x, y: b.y });

  const t = Math.min(1 - T_MARGIN, Math.max(T_MARGIN, grip.t));
  const u = 1 - t;
  // Moving p1 by w1·d and p2 by w2·d moves the point at t by
  // (3u²t·w1 + 3ut²·w2)·d. With w1 = k·u and w2 = k·t, this k makes it exactly d.
  const k = 1 / (3 * t * u * (u * u + t * t));
  a.outHandle = { x: p1.x + k * u * dx, y: p1.y + k * u * dy };
  b.inHandle = { x: p2.x + k * t * dx, y: p2.y + k * t * dy };

  if (aSmooth) a.inHandle = alignedOpposite(a, a.outHandle, a.inHandle!);
  if (bSmooth) b.outHandle = alignedOpposite(b, b.inHandle, b.outHandle!);
  return true;
}

/** `other` turned to point directly away from `moved` through the anchor, at
 *  its own length. */
function alignedOpposite(
  anchor: PenAnchor,
  moved: { x: number; y: number },
  other: { x: number; y: number },
): { x: number; y: number } {
  const mx = moved.x - anchor.x;
  const my = moved.y - anchor.y;
  const len = Math.hypot(mx, my);
  if (len === 0) return other;
  const keep = Math.hypot(other.x - anchor.x, other.y - anchor.y);
  return { x: anchor.x - (mx / len) * keep, y: anchor.y - (my / len) * keep };
}
