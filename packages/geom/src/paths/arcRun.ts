/**
 * A run of consecutive segments of a decoded subpath, measured by arc length:
 * where it is, and which way it heads, any distance along it. Curves are
 * measured by sampling, and points are then found on the curve itself, so a
 * point is exact and only its distance along the run is approximate.
 */
import { isStraightSegment, type PenAnchor } from './anchors';
import { cubicPointAt, type Point } from './cubicMath';

const LENGTH_SAMPLES = 48;

interface Seg {
  a: Point;
  c1: Point;
  c2: Point;
  b: Point;
  straight: boolean;
  /** Where the segment starts along the run. */
  from: number;
  len: number;
  /** Arc length to each of `LENGTH_SAMPLES + 1` evenly spaced parameters. */
  table: number[];
}

/** A run's measure: its length, and its point and unit heading at any
 *  distance along it. */
export interface ArcRun {
  length: number;
  pointAt(s: number): Point;
  /** The unit direction of travel at `s`. At a joint between segments it is
   *  the later segment's unless `arriving`, when it is the earlier one's. */
  headingAt(s: number, arriving?: boolean): Point;
}

const unit = (x: number, y: number): Point => {
  const len = Math.hypot(x, y);
  return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
};

function derivative(seg: Seg, t: number): Point {
  const u = 1 - t;
  const { a, c1, c2, b } = seg;
  return {
    x: 3 * u * u * (c1.x - a.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (b.x - c2.x),
    y: 3 * u * u * (c1.y - a.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (b.y - c2.y),
  };
}

function headingOn(seg: Seg, t: number): Point {
  if (seg.straight) return unit(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
  let d = derivative(seg, t);
  // A handle lying on its anchor zeroes the derivative there; step inside.
  if (Math.hypot(d.x, d.y) < 1e-9) d = derivative(seg, t < 0.5 ? t + 1e-3 : t - 1e-3);
  const h = unit(d.x, d.y);
  return h.x === 0 && h.y === 0 ? unit(seg.b.x - seg.a.x, seg.b.y - seg.a.y) : h;
}

function measure(a: PenAnchor, b: PenAnchor, from: number): Seg {
  const c1 = a.outHandle ?? a;
  const c2 = b.inHandle ?? b;
  const straight = isStraightSegment(a, b);
  const table = [0];
  if (straight) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let k = 1; k <= LENGTH_SAMPLES; k++) table.push((len * k) / LENGTH_SAMPLES);
  } else {
    let prev: Point = a;
    let len = 0;
    for (let k = 1; k <= LENGTH_SAMPLES; k++) {
      const p = cubicPointAt(a, c1, c2, b, k / LENGTH_SAMPLES);
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      table.push(len);
      prev = p;
    }
  }
  return { a, c1, c2, b, straight, from, len: table[LENGTH_SAMPLES], table };
}

/** The parameter on `seg` lying `d` along it. */
function paramAt(seg: Seg, d: number): number {
  const { table } = seg;
  if (seg.len === 0) return 0;
  let lo = 0;
  let hi = LENGTH_SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid] <= d) lo = mid;
    else hi = mid;
  }
  const span = table[hi] - table[lo];
  const f = span === 0 ? 0 : (d - table[lo]) / span;
  return Math.min(1, Math.max(0, (lo + f) / LENGTH_SAMPLES));
}

/** The run through `anchors[from..to]` of `sub`, indices taken modulo its
 *  length so a closed subpath's run may wrap past its end. */
export function arcRun(sub: readonly PenAnchor[], from: number, to: number): ArcRun {
  const n = sub.length;
  const segs: Seg[] = [];
  let length = 0;
  for (let i = from; i < to; i++) {
    const seg = measure(sub[i % n], sub[(i + 1) % n], length);
    segs.push(seg);
    length += seg.len;
  }
  const locate = (s: number, arriving: boolean): { seg: Seg; t: number } => {
    const d = Math.min(Math.max(s, 0), length);
    let k = 0;
    while (k < segs.length - 1 && (arriving ? segs[k].from + segs[k].len < d : segs[k].from + segs[k].len <= d)) k++;
    return { seg: segs[k], t: paramAt(segs[k], d - segs[k].from) };
  };
  const start: Point = { x: sub[from % n].x, y: sub[from % n].y };
  return {
    length,
    pointAt(s) {
      if (segs.length === 0) return start;
      const { seg, t } = locate(s, false);
      if (seg.straight) return { x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t };
      return cubicPointAt(seg.a, seg.c1, seg.c2, seg.b, t);
    },
    headingAt(s, arriving = false) {
      if (segs.length === 0) return { x: 0, y: 0 };
      const { seg, t } = locate(s, arriving);
      return headingOn(seg, t);
    },
  };
}
