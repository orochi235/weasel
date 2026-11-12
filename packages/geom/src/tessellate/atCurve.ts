import { bezierPoint, segmentCoords } from '../along/bezier';
import type { LengthRun } from '../along/lengthTable';
import { segmentLength } from '../paths/segmentLength';
import { lerp } from '../scalar';
import type { Polyline } from './polyline';

/** A curve position found on one flattening of its run. */
export interface PolylinePlace {
  /** How far from the polyline's first point it sits, along the polyline: the polyline's own measure. */
  length: number;
  /** The point itself, on the curve rather than on the chord beside it. */
  x: number;
  y: number;
}

/**
 * Where curve position (`segment`, `t`) falls on `pl`, a flattening of `run`.
 * Segment `k` runs from `pl`'s `k`-th anchor-aligned point to the next, a
 * closed `pl`'s closing edge last, as `pathLengthTable` counts them; `run`
 * gives each curve's control points, and without one every segment is
 * straight. The ends come from `pl`, so a run of the same shape carried
 * elsewhere (a rect shifted by alignment) places onto it too.
 */
export function polylineAtCurve(pl: Polyline, segment: number, t: number, run?: LengthRun): PolylinePlace {
  const p = pl.points;
  const n = p.length / 2;
  const ends = anchorIndices(pl, n);
  if (ends.length < 2) return { length: 0, x: p[0] ?? 0, y: p[1] ?? 0 };
  const k = Math.min(Math.max(Math.floor(segment), 0), ends.length - 2);
  const f = Math.min(Math.max(t, 0), 1);
  const i0 = ends[k];
  const i1 = ends[k + 1];
  const ctl = run?.controls?.[k];
  const seg = ctl && ctl.length > 0 ? segmentCoords([p[i0 * 2], p[i0 * 2 + 1], p[(i1 % n) * 2], p[(i1 % n) * 2 + 1]], ctl, 2, 0) : null;
  let x: number, y: number;
  if (seg) [x, y] = bezierPoint(seg, 2, f);
  else {
    x = lerp(p[i0 * 2], p[(i1 % n) * 2], f);
    y = lerp(p[i0 * 2 + 1], p[(i1 % n) * 2 + 1], f);
  }
  const { chord, u } = !seg && i1 - i0 === 1 ? { chord: i0, u: f } : chordOf(pl, n, i0, i1, x, y, seg ? arcShare(seg, f) : f);
  let length = 0;
  for (let i = 0; i < chord; i++) length += chordLength(p, n, i);
  return { length: length + u * chordLength(p, n, chord), x, y };
}

/** The indices of `pl`'s anchor-aligned points, then `n` for a closed one's return to its first. */
function anchorIndices(pl: Polyline, n: number): number[] {
  const { anchorA: A, anchorB: B } = pl;
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (!A || !B || A[i] === B[i]) out.push(i);
  if (pl.closed && n >= 2) out.push(n);
  return out;
}

/** Of the chords from `i0` to `i1`, the one point (x, y) lies beside and how far along it: first by
 *  arc-length share `share`, then by projection, which a flattening keeps within its tolerance. */
function chordOf(
  pl: Polyline, n: number, i0: number, i1: number, x: number, y: number, share: number,
): { chord: number; u: number } {
  const T = pl.anchorT;
  const at = (i: number) => (i >= i1 ? 1 : i <= i0 ? 0 : T ? T[i] : (i - i0) / (i1 - i0));
  let j = i0;
  while (j < i1 - 1 && at(j + 1) <= share) j++;
  let u = project(pl.points, n, j, x, y);
  // Step toward the chord the point projects onto, never back the way it came.
  const step = u < 0 ? -1 : u > 1 ? 1 : 0;
  while (step !== 0 && j + step >= i0 && j + step < i1 && (step < 0 ? u < 0 : u > 1)) {
    j += step;
    u = project(pl.points, n, j, x, y);
  }
  return { chord: j, u: Math.min(Math.max(u, 0), 1) };
}

function project(p: readonly number[], n: number, i: number, x: number, y: number): number {
  const ax = p[i * 2], ay = p[i * 2 + 1];
  const j = (i + 1) % n;
  const dx = p[j * 2] - ax, dy = p[j * 2 + 1] - ay;
  const l2 = dx * dx + dy * dy;
  return l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
}

function chordLength(p: readonly number[], n: number, i: number): number {
  const j = (i + 1) % n;
  return Math.hypot(p[j * 2] - p[i * 2], p[j * 2 + 1] - p[i * 2 + 1]);
}

/** The share of `seg`'s arc length that lies before parameter `t`. */
function arcShare(seg: readonly number[], t: number): number {
  const whole = segmentLength(seg, 2);
  return whole > 0 ? segmentLength(seg, 2, 0, t) / whole : t;
}
