/**
 * What roughen and zigzag share: a contour sampled at even steps of each
 * segment's parameter, and points joined back into a contour by straight
 * segments.
 */
import { cubicEvalAt } from '../curve';
import { tangentAt } from './cornerSegments';
import { lineSegment, type CubicContour, type CubicSegment } from './cubicContours';
import type { Point } from './cubicMath';

/** A point on a contour and the unit direction of travel there, `null` on a
 *  segment of no length. */
export interface ContourSample {
  at: Point;
  dir: Point | null;
}

function sampleAt({ c, line }: CubicSegment, t: number): ContourSample {
  const [x, y] = cubicEvalAt(...c, t);
  const seg = { line, p0: { x: c[0], y: c[1] }, c1: { x: c[2], y: c[3] }, c2: { x: c[4], y: c[5] }, p3: { x: c[6], y: c[7] } };
  return { at: { x, y }, dir: tangentAt(seg, t) };
}

/**
 * Each segment of `contour` sampled at `t = k / pieces` for `k` in
 * `0..pieces-1`. An open contour ends with its last point, which takes the
 * direction its last segment ends on.
 */
export function sampleContour(contour: CubicContour, pieces: number): ContourSample[] {
  const out: ContourSample[] = [];
  for (const seg of contour.segs) for (let k = 0; k < pieces; k++) out.push(sampleAt(seg, k / pieces));
  const last = contour.segs.at(-1);
  if (!contour.closed && last !== undefined) out.push(sampleAt(last, 1));
  return out;
}

/** `points` joined by straight segments. A closed one leaves its last edge
 *  to the close, so its first point is not written twice. */
export function polylineContour(points: readonly Point[], closed: boolean): CubicContour {
  const segs: CubicSegment[] = [];
  for (let i = 1; i < points.length; i++) {
    segs.push(lineSegment(points[i - 1]!.x, points[i - 1]!.y, points[i]!.x, points[i]!.y));
  }
  return { segs, closed };
}

/** A whole number from `min` to 1000, from a param that may be absent or fractional. */
export function countParam(value: number | undefined, fallback: number, min = 0): number {
  const v = value === undefined || !Number.isFinite(value) ? fallback : Math.round(value);
  return Math.max(min, Math.min(v, 1000));
}
