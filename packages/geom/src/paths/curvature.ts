import type { AnchorSet } from './anchorEdits';
import { isStraightSegment, segmentEnds } from './anchors';
import { cubicPointAt, type Point } from './cubicMath';

/** First derivative of the cubic Bezier (p0, p1, p2, p3) at t. */
export function cubicDerivativeAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

function cubicSecondDerivativeAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: 6 * u * (p2.x - 2 * p1.x + p0.x) + 6 * t * (p3.x - 2 * p2.x + p1.x),
    y: 6 * u * (p2.y - 2 * p1.y + p0.y) + 6 * t * (p3.y - 2 * p2.y + p1.y),
  };
}

/**
 * Signed curvature of the cubic Bezier (p0, p1, p2, p3) at t: one over the
 * radius of the circle that fits the curve there. Positive where the curve
 * turns toward its left normal `(-dy, dx)`, negative where it turns away, so
 * the sign flips at an inflection. 0 where the curve has no direction at t, as
 * at an end whose handle sits on its anchor.
 */
export function cubicCurvatureAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): number {
  const d1 = cubicDerivativeAt(p0, p1, p2, p3, t);
  const d2 = cubicSecondDerivativeAt(p0, p1, p2, p3, t);
  const den = Math.pow(d1.x * d1.x + d1.y * d1.y, 1.5);
  if (den < 1e-12) return 0;
  return (d1.x * d2.y - d1.y * d2.x) / den;
}

/** One tooth of a curvature comb: a point on the curve and the tip of the
 *  tooth standing on it. */
export interface CombTooth {
  /** The point on the curve. */
  x: number;
  y: number;
  /** The tooth's tip: off the curve along its normal, on the outside of the
   *  bend, by the curvature times the comb's scale. */
  tipX: number;
  tipY: number;
  /** Signed curvature at the point, as {@link cubicCurvatureAt} gives it. */
  curvature: number;
}

/** The comb of one curved segment, which runs from anchor `segIdx` of
 *  subpath `sub` to the next. */
export interface SegmentComb {
  sub: number;
  segIdx: number;
  /** Evenly spaced in t, ends included. */
  teeth: CombTooth[];
}

/** Options for {@link curvatureComb} and {@link combTeeth}. */
export interface CurvatureCombOptions {
  /** Tooth length per unit of curvature. A tooth over a stretch of radius r is
   *  `scale / r` long, in the curve's own units. */
  scale: number;
  /** Teeth per segment for {@link curvatureComb}, or along the whole source
   *  for {@link combTeeth}; ends included. Default 24; at least 2. */
  samplesPerSegment?: number;
}

/**
 * A curve parameterized over t in [0, 1], as a curvature comb reads it. Any
 * curve can stand a comb this way, whether or not it is a path.
 */
export interface CurvatureSource {
  /** The point on the curve at t. */
  pointAt(t: number): Point;
  /** A vector along the direction of travel at t. Only its direction is read;
   *  a zero vector means the curve has no direction there. */
  tangentAt(t: number): Point;
  /** Signed curvature at t, positive where the curve turns toward its left
   *  normal `(-dy, dx)`, as {@link cubicCurvatureAt} gives it. */
  curvatureAt(t: number): number;
}

/** How far in from an end a tooth moves when the curve has no direction at
 *  the end itself, so it reports the curvature the end is approached with. */
const END_NUDGE = 1e-3;

function sampleCount(opts: CurvatureCombOptions): number {
  return Math.max(2, Math.round(opts.samplesPerSegment ?? 24));
}

/**
 * The teeth of a curvature comb along `source`, evenly spaced in t with both
 * ends included. Each stands out of the curve along its normal, on the outside
 * of the bend, `scale` times the curvature long.
 */
export function combTeeth(source: CurvatureSource, opts: CurvatureCombOptions): CombTooth[] {
  const samples = sampleCount(opts);
  const teeth: CombTooth[] = [];
  for (let i = 0; i < samples; i++) teeth.push(toothAt(source, i / (samples - 1), opts.scale));
  return teeth;
}

/** The cubic Bezier (p0, p1, p2, p3) as a {@link CurvatureSource}. */
export function cubicCurvatureSource(p0: Point, p1: Point, p2: Point, p3: Point): CurvatureSource {
  return {
    pointAt: (t) => cubicPointAt(p0, p1, p2, p3, t),
    tangentAt: (t) => cubicDerivativeAt(p0, p1, p2, p3, t),
    curvatureAt: (t) => cubicCurvatureAt(p0, p1, p2, p3, t),
  };
}

/**
 * Curvature combs for every curved segment of `set`: teeth that stand out of
 * the curve, each as long as the curvature where it stands. Joining their tips
 * draws how the bend changes along the path. A tooth that jumps in length at
 * an anchor shows a curvature break there; teeth that change side show an
 * inflection. Straight segments have no curvature, and no comb.
 */
export function curvatureComb(set: AnchorSet, opts: CurvatureCombOptions): SegmentComb[] {
  const out: SegmentComb[] = [];
  for (let sub = 0; sub < set.anchors.length; sub++) {
    const count = set.anchors[sub].length - (set.closed[sub] ? 0 : 1);
    for (let segIdx = 0; segIdx < count; segIdx++) {
      const ends = segmentEnds(set.anchors, set.closed, sub, segIdx);
      if (!ends || isStraightSegment(ends.a, ends.b)) continue;
      const { a, b } = ends;
      const source = cubicCurvatureSource(a, a.outHandle ?? a, b.inHandle ?? b, b);
      out.push({ sub, segIdx, teeth: combTeeth(source, opts) });
    }
  }
  return out;
}

function toothAt(source: CurvatureSource, t: number, scale: number): CombTooth {
  const at = source.pointAt(t);
  let d = source.tangentAt(t);
  let k = source.curvatureAt(t);
  if (Math.hypot(d.x, d.y) < 1e-9) {
    const inner = t < 0.5 ? t + END_NUDGE : t - END_NUDGE;
    d = source.tangentAt(inner);
    k = source.curvatureAt(inner);
  }
  const len = Math.hypot(d.x, d.y);
  if (len < 1e-12) return { x: at.x, y: at.y, tipX: at.x, tipY: at.y, curvature: 0 };
  // The bend's center lies along the left normal times 1/k, so the tooth goes
  // the other way: outside the bend on either side of an inflection.
  const nx = -d.y / len;
  const ny = d.x / len;
  return { x: at.x, y: at.y, tipX: at.x - nx * k * scale, tipY: at.y - ny * k * scale, curvature: k };
}
