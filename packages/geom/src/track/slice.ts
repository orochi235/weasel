import { clamp } from '../scalar';
import { arcShape, type ArcTrackShape } from './arc';
import { ellipseShape, type EllipseTrackShape } from './ellipse';
import { lineShape, type TrackShape } from './shape';

const RAD = Math.PI / 180;

/** The direction of `p` seen from `c`, in degrees clockwise from 12 o'clock on a y-down plane. */
const seen = (c: { x: number; y: number }, p: { x: number; y: number }): number => Math.atan2(p.x - c.x, c.y - p.y) / RAD;

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
      const f = clamp(n.f, lo, hi);
      const q = shape.at(f).point;
      return { f: span === 0 ? 0 : (f - lo) / span, dist: Math.hypot(p.x - q.x, p.y - q.y) };
    },
  };
}
