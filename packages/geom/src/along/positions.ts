import { lookupT } from './arcLookup';
import { bezierDirection, bezierPoint } from './bezier';
import { segmentArc, tableInternals, type LengthTable, type SegmentArc } from './lengthTable';
import { lerp } from '../scalar';

type Comps = [number, number, number];

/**
 * The point at pen-order length `s`, and the unit tangent of the segment
 * arriving there (leaving, at a run's start); on a curve, the exact point and
 * the curve's own direction. Components past the table's
 * `dim` read 0. Clamps to the path; where two runs meet, answers the end of the
 * earlier one. A path with no length answers a zero tangent.
 */
export function pointAtLength(t: LengthTable, s: number): { point: Comps; tangent: Comps } {
  const { cum } = tableInternals(t);
  const len = Number.isNaN(s) ? 0 : Math.min(Math.max(s, 0), t.total);
  let r = 0;
  while (r < cum.length && !(cum[r].length >= 2 && len <= t.runStart[r + 1])) r++;
  if (r === cum.length) r = -1;
  if (r < 0) {
    r = t.runs.length - 1;
    while (r >= 0 && t.runs[r].points.length < t.dim) r--;
    if (r < 0) return { point: [0, 0, 0], tangent: [0, 0, 0] };
    return { point: at(t, r, 0), tangent: [0, 0, 0] };
  }
  const c = cum[r];
  let lo = 0;
  let hi = c.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (c[mid + 1] < len) lo = mid + 1;
    else hi = mid;
  }
  return pointOnSegment(t, r, lo, len);
}

/**
 * @internal {@link pointAtLength} on a segment already found: the point at
 * pen-order length `len` on segment `i` of run `r`, `len` clamped to it.
 */
export function pointOnSegment(t: LengthTable, r: number, i: number, len: number): { point: Comps; tangent: Comps } {
  const arc = segmentArc(t, r, i);
  if (arc) {
    const u = arcParam(t, arc, r, i, len);
    return { point: bezierPoint(arc.coords, t.dim, u), tangent: bezierDirection(arc.coords, t.dim, u) ?? tangentNear(t, r, i) };
  }
  return { point: linePoint(t, r, i, len), tangent: tangentNear(t, r, i) };
}

/** @internal {@link pointOnSegment}'s point alone, given the segment's `segmentArc` when the caller kept it, and
 *  written into `out` on a curve when given. */
export function pointOnSegmentOnly(
  t: LengthTable, r: number, i: number, len: number, arc: SegmentArc | null = segmentArc(t, r, i), out?: Comps,
): Comps {
  return arc ? bezierPoint(arc.coords, t.dim, arcParam(t, arc, r, i, len), out) : linePoint(t, r, i, len);
}

function arcParam(t: LengthTable, arc: SegmentArc, r: number, i: number, len: number): number {
  const c = tableInternals(t).cum[r];
  return lookupT(arc.coords, t.dim, arc.lookup, Math.min(Math.max(len - c[i], 0), c[i + 1] - c[i]));
}

function linePoint(t: LengthTable, r: number, i: number, len: number): Comps {
  const c = tableInternals(t).cum[r];
  const span = c[i + 1] - c[i];
  const local = Math.min(Math.max(len - c[i], 0), span);
  const f = span > 0 ? local / span : 0;
  const a = at(t, r, i);
  const b = at(t, r, i + 1);
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

/** Point `i` of run `r`, wrapping a closed run's closing edge back to its first. */
function at(t: LengthTable, r: number, i: number): Comps {
  const { points } = t.runs[r];
  const n = Math.floor(points.length / t.dim);
  const o = (i % n) * t.dim;
  return [points[o], points[o + 1], t.dim === 3 ? points[o + 2] : 0];
}

/** The direction of segment `i`, or of the nearest one with length, looking back first. */
function tangentNear(t: LengthTable, r: number, i: number): Comps {
  const last = tableInternals(t).cum[r].length - 2;
  for (let k = i; k >= 0; k--) { const d = direction(t, r, k); if (d) return d; }
  for (let k = i + 1; k <= last; k++) { const d = direction(t, r, k); if (d) return d; }
  return [0, 0, 0];
}

function direction(t: LengthTable, r: number, i: number): Comps | null {
  const a = at(t, r, i);
  const b = at(t, r, i + 1);
  const d: Comps = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(d[0], d[1], d[2]);
  return l > 0 ? [d[0] / l, d[1] / l, d[2] / l] : null;
}

