import { DEG_TO_RAD } from '../angle';
import { clamp } from '../scalar';
import { arcShape, type ArcTrackShape } from './arc';
import { ellipseShape, type EllipseTrackShape } from './ellipse';
import { lineShape, type TrackShape } from './shape';

/** The direction of `p` seen from `c`, in degrees clockwise from 12 o'clock on a y-down plane. */
const seen = (c: { x: number; y: number }, p: { x: number; y: number }): number => Math.atan2(p.x - c.x, c.y - p.y) / DEG_TO_RAD;

/**
 * The stretch `from..to` of a shape (fractions of it, `from` below `to`) as a shape of its own, running the same way.
 * An arc stays an arc and an ellipse an ellipse, so `trackShapeD` still draws it as one; any other shape is read through.
 */
export function trackSlice(shape: TrackShape, from: number, to: number): TrackShape {
  const lo = clamp(Math.min(from, to), 0, 1);
  const hi = clamp(Math.max(from, to), 0, 1);
  if (lo === 0 && hi === 1) return shape;
  const a = shape.at(lo).point;
  const b = shape.at(hi).point;
  if (shape.kind === 'line') return lineShape(a, b);
  if (shape.kind === 'arc' && 'arc' in shape) {
    const { center, radius, direction } = (shape as ArcTrackShape).arc;
    if (hi === lo) return arcShape({ center, radius: 0, start: 0, end: 0 });
    return arcShape({ center, radius, start: seen(center, a), end: seen(center, b), direction });
  }
  if (shape.kind === 'ellipse' && 'ellipse' in shape) {
    const { center, radiusX, radiusY, direction } = (shape as EllipseTrackShape).ellipse;
    if (hi === lo) return ellipseShape({ center, radiusX: 0, radiusY: 0, start: 0, end: 0 });
    return ellipseShape({ center, radiusX, radiusY, start: seen(center, a), end: seen(center, b), direction });
  }
  const span = hi - lo;
  return {
    kind: shape.kind,
    length: shape.length * span,
    closed: false,
    at: (f, options) => shape.at(lo + (options?.open ? f : clamp(f, 0, 1)) * span, options),
    nearest(p) {
      const n = shape.nearest(p);
      if (span === 0) return { f: 0, dist: distanceAt(shape, lo, p) };
      if (n.f >= lo && n.f <= hi) return { f: (n.f - lo) / span, dist: n.dist };
      // The whole shape's nearest point is off the stretch, which says nothing of where the stretch's own is.
      const f = nearestWithin(shape, lo, hi, p);
      return { f: (f - lo) / span, dist: distanceAt(shape, f, p) };
    },
  };
}

const distanceAt = (shape: TrackShape, f: number, p: { x: number; y: number }): number => {
  const q = shape.at(f).point;
  return Math.hypot(p.x - q.x, p.y - q.y);
};

/** Samples a stretch is searched at before the best of them is refined. */
const SLICE_SAMPLES = 64;

/** The fraction of `shape` in `lo..hi` nearest `p`: the best of evenly spaced samples, narrowed by golden section
 *  between its neighbors. */
function nearestWithin(shape: TrackShape, lo: number, hi: number, p: { x: number; y: number }): number {
  const step = (hi - lo) / SLICE_SAMPLES;
  let best = lo;
  let bestD = distanceAt(shape, lo, p);
  for (let i = 1; i <= SLICE_SAMPLES; i++) {
    const f = i === SLICE_SAMPLES ? hi : lo + i * step;
    const d = distanceAt(shape, f, p);
    if (d < bestD) [best, bestD] = [f, d];
  }
  let a = Math.max(lo, best - step);
  let b = Math.min(hi, best + step);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 40; i++) {
    const c = b - g * (b - a);
    const e = a + g * (b - a);
    if (distanceAt(shape, c, p) < distanceAt(shape, e, p)) b = e; else a = c;
  }
  const mid = (a + b) / 2;
  return distanceAt(shape, mid, p) < bestD ? mid : best;
}
