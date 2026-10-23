import type { Point } from '../paths/cubicMath';
import { clamp } from '../scalar';
import type { TrackAtOptions, TrackNearestOptions, TrackShape, TrackStation } from './shape';

const SAMPLES = 256;

const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;

/** Which way `shape` bends, against its own normal: 1 toward it, -1 away from it, 0 straight. A shape that bends both
 *  ways answers for the way it turns more in all. An arc and an ellipse bend away from their normal. */
export function bendSide(shape: TrackShape): -1 | 0 | 1 {
  let turn = 0;
  let prev = shape.at(0);
  for (let i = 1; i <= SAMPLES; i++) {
    const next = shape.at(i / SAMPLES);
    turn += dot({ x: next.tangent.x - prev.tangent.x, y: next.tangent.y - prev.tangent.y }, prev.normal);
    prev = next;
  }
  return Math.abs(turn) < 1e-9 ? 0 : turn > 0 ? 1 : -1;
}

/**
 * The track `shift` px along `shape`'s normal from it at every point — negative is against the normal — as a track
 * of its own, addressed by fraction of its own length, its tangent and normal those of `shape` at the point it came
 * from. Null when the shift reaches a center of curvature, where the track would fold back over itself: an arc shifted
 * in by its radius or more.
 */
export function shiftTrack(shape: TrackShape, shift: number): TrackShape | null {
  if (shift === 0) return shape;
  const moved = (s: TrackStation): TrackStation => ({ ...s, point: { x: s.point.x + shift * s.normal.x, y: s.point.y + shift * s.normal.y } });
  // `table[i]` is the shifted track's length to the base's fraction i / SAMPLES.
  const table = new Float64Array(SAMPLES + 1);
  let prev = moved(shape.at(0));
  for (let i = 1; i <= SAMPLES; i++) {
    const next = moved(shape.at(i / SAMPLES));
    const step = { x: next.point.x - prev.point.x, y: next.point.y - prev.point.y };
    const tangent = { x: prev.tangent.x + next.tangent.x, y: prev.tangent.y + next.tangent.y };
    if (shape.length > 0 && dot(step, tangent) <= 0) return null;
    table[i] = table[i - 1]! + Math.hypot(step.x, step.y);
    prev = next;
  }
  const length = table[SAMPLES]!;
  const per = shape.length / SAMPLES;
  // Base length per shifted length off either end, where the track carries on as its shape does.
  const startRatio = table[1]! > 0 ? per / table[1]! : 1;
  const endRatio = table[SAMPLES]! - table[SAMPLES - 1]! > 0 ? per / (table[SAMPLES]! - table[SAMPLES - 1]!) : 1;

  /** The base fraction under shifted fraction `f`, carried on past the ends at the end's ratio. */
  const toBase = (f: number): number => {
    const d = f * length;
    if (length <= 0 || shape.length <= 0) return f;
    if (d < 0) return (d * startRatio) / shape.length;
    if (d > length) return 1 + ((d - length) * endRatio) / shape.length;
    let lo = 0;
    let hi = SAMPLES;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid]! <= d) lo = mid;
      else hi = mid;
    }
    const span = table[hi]! - table[lo]!;
    return (lo + (span > 0 ? (d - table[lo]!) / span : 0)) / SAMPLES;
  };

  /** The shifted fraction over base fraction `g`, the inverse of {@link toBase}. */
  const fromBase = (g: number): number => {
    if (length <= 0 || shape.length <= 0) return g;
    if (g < 0) return (g * shape.length) / startRatio / length;
    if (g > 1) return (length + ((g - 1) * shape.length) / endRatio) / length;
    const x = g * SAMPLES;
    const i = Math.min(SAMPLES - 1, Math.floor(x));
    return (table[i]! + (x - i) * (table[i + 1]! - table[i]!)) / length;
  };

  const at = (f: number, options?: TrackAtOptions): TrackStation =>
    moved(shape.at(toBase(options?.open ? f : clamp(f, 0, 1)), options));

  return {
    kind: shape.kind,
    length,
    closed: shape.closed,
    at,
    nearest(p: Point, options?: TrackNearestOptions) {
      const base = shape.nearest(p, options?.open ? { open: true, about: toBase(options.about ?? 0.5) } : undefined);
      const f = fromBase(base.f);
      const q = at(f, options).point;
      return { f, dist: Math.hypot(p.x - q.x, p.y - q.y) };
    },
  };
}
