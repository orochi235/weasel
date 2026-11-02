import type { Point } from '../paths/cubicMath';
import { DEG_TO_RAD, wrapPositive } from '../angle';
import { clamp } from '../scalar';
import type { TrackAtOptions, TrackNearest, TrackShape, TrackStation } from './shape';

/** An axis-aligned elliptical arc track. `start` and `end` are directions seen from the center, in degrees clockwise
 *  from 12 o'clock on a y-down plane, as an arc's are; equal `start` and `end` is the whole ellipse. */
export interface EllipseTrackSpec {
  center: Point;
  /** Half the width. */
  radiusX: number;
  /** Half the height. */
  radiusY: number;
  start: number;
  end: number;
  /** Which way the track runs from `start` to `end`. Default `'cw'`. */
  direction?: 'cw' | 'ccw';
}

/** A track shape that remembers the ellipse it was built from, so path data can be drawn as elliptical arcs. */
export type EllipseTrackShape = TrackShape & { readonly ellipse: EllipseTrackSpec };

/** Pieces the sweep is cut into for the length table, and Simpson panels in each. */
const PIECES = 128;
const PANELS = 4;
/** Samples round the whole ellipse an open `nearest` starts its search from. */
const RING = 256;

/** The ellipse in sweep offsets: degrees of its own parameter from the track's start, in the track's direction. */
interface Param {
  center: Point;
  a: number;
  b: number;
  /** The start's parameter, clockwise from 12 o'clock: the point at `t` is (a sin t, -b cos t) from the center. */
  t0: number;
  sign: 1 | -1;
}

const pointAt = ({ center, a, b, t0, sign }: Param, u: number): Point => {
  const t = (t0 + sign * u) * DEG_TO_RAD;
  return { x: center.x + a * Math.sin(t), y: center.y - b * Math.cos(t) };
};

/** Length along the ellipse per degree of offset at `u`. */
const speed = ({ a, b, t0, sign }: Param, u: number): number => {
  const t = (t0 + sign * u) * DEG_TO_RAD;
  return Math.hypot(a * Math.cos(t), b * Math.sin(t)) * DEG_TO_RAD;
};

/** The length table over `sweep` degrees: the length to any offset, and the offset at any fraction of the length. */
function lengthTable(e: Param, sweep: number) {
  const simpson = (u0: number, u1: number) => {
    const h = (u1 - u0) / PANELS;
    let sum = speed(e, u0) + speed(e, u1);
    for (let i = 1; i < PANELS; i++) sum += speed(e, u0 + i * h) * (i % 2 ? 4 : 2);
    return (sum * h) / 3;
  };
  const du = sweep / PIECES;
  const table = [0];
  for (let i = 0; i < PIECES; i++) table.push(table[i]! + simpson(i * du, (i + 1) * du));
  const length = table[PIECES]!;

  /** Length from the start to offset `u`, negative before the start; beyond the sweep, by integration. */
  const lengthTo = (u: number): number => {
    if (u >= 0 && u <= sweep) {
      const i = Math.min(PIECES - 1, Math.floor(u / du));
      return table[i]! + simpson(i * du, u);
    }
    const n = Math.max(1, Math.ceil(Math.abs(u) / du));
    let s = 0;
    for (let i = 0; i < n; i++) s += simpson((u * i) / n, (u * (i + 1)) / n);
    return s;
  };
  const offsetAt = (f: number): number => {
    if (length === 0) return f * sweep;
    const s = f * length;
    let lo = 0;
    let hi = PIECES;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid]! <= s) lo = mid;
      else hi = mid;
    }
    const piece = table[lo + 1]! - table[lo]!;
    let u = (lo + (piece === 0 ? 0 : (s - table[lo]!) / piece)) * du;
    // The table's straight-line guess, made consistent with `lengthTo`, which `nearest` answers through.
    for (let i = 0; i < 3; i++) {
      const v = speed(e, u);
      if (!(v > 0)) break;
      u -= (lengthTo(u) - s) / v;
    }
    return u;
  };
  return { length, lengthTo, offsetAt };
}

const dist2 = (e: Param, p: Point, u: number) => {
  const q = pointAt(e, u);
  return (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
};

/**
 * The offset nearest `p` among `n` samples from `lo` to `hi`, refined by Newton's method within a sample of it. A tie
 * goes to the later sample when `late`, else the earlier: an arc's tie between its ends goes to its end, and an open
 * one's, half a turn from `about`, to the side before it.
 */
function footBetween(e: Param, p: Point, lo: number, hi: number, n: number, late: boolean): number {
  let best = lo;
  let bestD = dist2(e, p, lo);
  const step = (hi - lo) / n;
  for (let i = 1; i <= n; i++) {
    const v = i === n ? hi : lo + i * step;
    const d = dist2(e, p, v);
    if (late ? d <= bestD * (1 + 1e-12) : d < bestD * (1 - 1e-12)) [best, bestD] = [v, d];
  }
  const { a, b, t0, sign } = e;
  const dx = p.x - e.center.x;
  const dy = p.y - e.center.y;
  let u = best;
  for (let i = 0; i < 12; i++) {
    // d/dt of half the squared distance, and its derivative, at t = t0 + sign u.
    const t = (t0 + sign * u) * DEG_TO_RAD;
    const s = Math.sin(t);
    const c = Math.cos(t);
    const g = (a * a - b * b) * s * c - dx * a * c - dy * b * s;
    const g1 = (a * a - b * b) * (c * c - s * s) + dx * a * s - dy * b * c;
    if (!(g1 > 0)) break;
    const next = clamp(u - (sign * g) / g1 / DEG_TO_RAD, Math.max(lo, best - step), Math.min(hi, best + step));
    if (Math.abs(next - u) < 1e-12) break;
    u = next;
  }
  return dist2(e, p, u) <= bestD ? u : best;
}

/**
 * An elliptical arc track, addressed by fraction of its length; its normal points away from the center, square to the
 * ellipse, whichever way it runs. With equal radii it is `arcShape`'s arc.
 */
export function ellipseShape(spec: EllipseTrackSpec): EllipseTrackShape {
  const { center, radiusX: a, radiusY: b } = spec;
  const sign = spec.direction === 'ccw' ? -1 : 1;
  const param = (seenDeg: number) => Math.atan2(b * Math.sin(seenDeg * DEG_TO_RAD), a * Math.cos(seenDeg * DEG_TO_RAD)) / DEG_TO_RAD;
  const e: Param = { center, a, b, t0: param(spec.start), sign };
  const raw = wrapPositive(sign * (param(spec.end) - e.t0), 360);
  const sweep = raw === 0 ? 360 : raw;
  const { length, lengthTo, offsetAt } = lengthTable(e, sweep);
  /** The offset `f` of the length along, `f` outside 0..1: a whole ellipse wraps; an arc carries on round its ellipse. */
  const offsetPast = (f: number): number => {
    if (raw === 0) return offsetAt(((f % 1) + 1) % 1);
    let u = f * sweep;
    for (let i = 0; i < 8; i++) {
      const v = speed(e, u);
      if (!(v > 0)) break;
      u -= (lengthTo(u) - f * length) / v;
    }
    return u;
  };

  const at = (f: number, options?: TrackAtOptions): TrackStation => {
    const u = options?.open && (f < 0 || f > 1) ? offsetPast(f) : offsetAt(clamp(f, 0, 1));
    const t = (e.t0 + sign * u) * DEG_TO_RAD;
    const s = Math.sin(t);
    const c = Math.cos(t);
    const k = Math.hypot(a * c, b * s);
    const tangent = k === 0 ? { x: sign * c, y: sign * s } : { x: (sign * a * c) / k, y: (sign * b * s) / k };
    const normal = k === 0 ? { x: s, y: -c } : { x: (b * s) / k, y: (-a * c) / k };
    return { point: pointAt(e, u), tangent, normal };
  };

  const shape: TrackShape = {
    kind: 'ellipse',
    length,
    closed: raw === 0,
    at,
    nearest(p, options): TrackNearest {
      const u = footBetween(e, p, 0, sweep, PIECES, true);
      const f = length === 0 ? 0 : clamp(lengthTo(u) / length, 0, 1);
      const dist = Math.sqrt(dist2(e, p, u));
      if (!options?.open || length === 0) return { f, dist };
      // Searched only within half a turn either side of `about`, so the answer is already unwrapped about it.
      const mid = offsetAt(options.about ?? 0.5);
      return { f: lengthTo(footBetween(e, p, mid - 180, mid + 180, RING, false)) / length, dist };
    },
  };
  Object.defineProperty(shape, 'ellipse', { value: spec, enumerable: false });
  return shape as EllipseTrackShape;
}
