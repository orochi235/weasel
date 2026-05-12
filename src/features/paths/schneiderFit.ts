/**
 * Schneider (1990, Graphics Gems I) adaptive cubic-Bezier fitter.
 * Given a sequence of sample points, returns a `PolygonPath` whose `C`
 * segments approximate the samples within `errorTolerance` world units.
 *
 * Output shape: an initial `M` to the first sample, followed by N
 * `C` cubic segments. For colinear / two-point inputs, returns a single
 * degenerate cubic. For empty input, returns an empty polygon path.
 *
 * NOTE: Task 4 ships only the API surface + degenerate handling. The
 * full LS / reparameterization / split machinery is added in Tasks 5–7.
 */

import { PathBuilder } from './builder';
import type { PolygonPath } from './types';

export interface SchneiderPoint {
  x: number;
  y: number;
}

export function schneiderFit(
  samples: ReadonlyArray<SchneiderPoint>,
  errorTolerance: number,
): PolygonPath {
  if (samples.length === 0) {
    return {
      kind: 'polygon',
      commands: new Uint8Array(),
      coords: new Float32Array(),
      fillRule: 'nonzero',
    };
  }

  const b = new PathBuilder();
  b.moveTo(samples[0].x, samples[0].y);

  if (samples.length === 1) {
    return b.build();
  }

  if (samples.length === 2) {
    emitStraightCubic(b, samples[0], samples[1]);
    return b.build();
  }

  fitRecursive(samples, errorTolerance, b);
  return b.build();
}

function fitRecursive(
  samples: ReadonlyArray<SchneiderPoint>,
  errorTolerance: number,
  b: PathBuilder,
): void {
  if (samples.length === 2) {
    const fit = fitOneCubic(samples);
    b.curveTo(fit.cp1.x, fit.cp1.y, fit.cp2.x, fit.cp2.y, fit.end.x, fit.end.y);
    return;
  }
  const fit = fitOneCubic(samples);
  const { worstIndex, worstError } = measureError(samples, fit);
  if (worstError <= errorTolerance * errorTolerance) {
    b.curveTo(fit.cp1.x, fit.cp1.y, fit.cp2.x, fit.cp2.y, fit.end.x, fit.end.y);
    return;
  }
  // Split. Both halves include the split sample so endpoints meet.
  const left = samples.slice(0, worstIndex + 1);
  const right = samples.slice(worstIndex);
  fitRecursive(left, errorTolerance, b);
  fitRecursive(right, errorTolerance, b);
}

function measureError(
  samples: ReadonlyArray<SchneiderPoint>,
  fit: CubicFit,
): { worstIndex: number; worstError: number } {
  let worstIndex = 1;
  let worstError = 0;
  const a = samples[0];
  for (let i = 1; i < samples.length - 1; i++) {
    const t = i / (samples.length - 1);
    const u = 1 - t;
    const qx = u*u*u*a.x + 3*u*u*t*fit.cp1.x + 3*u*t*t*fit.cp2.x + t*t*t*fit.end.x;
    const qy = u*u*u*a.y + 3*u*u*t*fit.cp1.y + 3*u*t*t*fit.cp2.y + t*t*t*fit.end.y;
    const dx = samples[i].x - qx;
    const dy = samples[i].y - qy;
    const sq = dx * dx + dy * dy;
    if (sq > worstError) {
      worstError = sq;
      worstIndex = i;
    }
  }
  return { worstIndex, worstError };
}

interface CubicFit {
  cp1: SchneiderPoint;
  cp2: SchneiderPoint;
  end: SchneiderPoint;
}

function fitOneCubic(samples: ReadonlyArray<SchneiderPoint>): CubicFit {
  const n = samples.length;
  const a = samples[0];
  const e = samples[n - 1];
  const tStart = unit(sub(samples[1], a));
  const tEnd = unit(sub(samples[n - 2], e));

  const ts = chordLengthParam(samples);
  if (ts === null) return { cp1: { ...a }, cp2: { ...e }, end: e };

  let fit = solveLS(samples, ts, a, e, tStart, tEnd);
  for (let pass = 0; pass < 4; pass++) {
    reparameterize(samples, ts, a, e, fit);
    fit = solveLS(samples, ts, a, e, tStart, tEnd);
  }
  return fit;
}

function chordLengthParam(samples: ReadonlyArray<SchneiderPoint>): number[] | null {
  const n = samples.length;
  const ts = new Array<number>(n);
  ts[0] = 0;
  let total = 0;
  for (let i = 1; i < n; i++) {
    total += dist(samples[i - 1], samples[i]);
    ts[i] = total;
  }
  if (total === 0) return null;
  for (let i = 0; i < n; i++) ts[i] /= total;
  return ts;
}

function solveLS(
  samples: ReadonlyArray<SchneiderPoint>,
  ts: ReadonlyArray<number>,
  a: SchneiderPoint,
  e: SchneiderPoint,
  tStart: SchneiderPoint,
  tEnd: SchneiderPoint,
): CubicFit {
  const n = samples.length;
  let c11 = 0, c12 = 0, c22 = 0, x1 = 0, x2 = 0;
  for (let i = 0; i < n; i++) {
    const t = ts[i];
    const u = 1 - t;
    const b0 = u * u * u;
    const b1 = 3 * u * u * t;
    const b2 = 3 * u * t * t;
    const b3 = t * t * t;
    const A1x = b1 * tStart.x;
    const A1y = b1 * tStart.y;
    const A2x = b2 * tEnd.x;
    const A2y = b2 * tEnd.y;
    c11 += A1x * A1x + A1y * A1y;
    c12 += A1x * A2x + A1y * A2y;
    c22 += A2x * A2x + A2y * A2y;
    const targetX = samples[i].x - (b0 + b1) * a.x - (b2 + b3) * e.x;
    const targetY = samples[i].y - (b0 + b1) * a.y - (b2 + b3) * e.y;
    x1 += A1x * targetX + A1y * targetY;
    x2 += A2x * targetX + A2y * targetY;
  }
  const det = c11 * c22 - c12 * c12;
  let alpha1: number;
  let alpha2: number;
  if (Math.abs(det) < 1e-12) {
    const chord = dist(a, e);
    alpha1 = alpha2 = chord / 3;
  } else {
    alpha1 = (c22 * x1 - c12 * x2) / det;
    alpha2 = (c11 * x2 - c12 * x1) / det;
    if (alpha1 < 1e-6 || alpha2 < 1e-6) {
      const chord = dist(a, e);
      alpha1 = alpha2 = chord / 3;
    }
  }
  return {
    cp1: { x: a.x + tStart.x * alpha1, y: a.y + tStart.y * alpha1 },
    cp2: { x: e.x + tEnd.x * alpha2, y: e.y + tEnd.y * alpha2 },
    end: e,
  };
}

function reparameterize(
  samples: ReadonlyArray<SchneiderPoint>,
  ts: number[],
  a: SchneiderPoint,
  e: SchneiderPoint,
  fit: CubicFit,
): void {
  void a; void e;
  for (let i = 1; i < samples.length - 1; i++) {
    ts[i] = newtonRefineT(samples[i], ts[i], samples[0], fit.cp1, fit.cp2, samples[samples.length - 1]);
  }
}

function newtonRefineT(
  p: SchneiderPoint,
  t: number,
  p0: SchneiderPoint,
  p1: SchneiderPoint,
  p2: SchneiderPoint,
  p3: SchneiderPoint,
): number {
  // Q(t) - p, where Q is the cubic. Newton step uses Q'(t)·(Q(t)-p) and
  // a second-derivative correction.
  const u = 1 - t;
  const qx = u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x;
  const qy = u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y;
  const qpx = 3*u*u*(p1.x - p0.x) + 6*u*t*(p2.x - p1.x) + 3*t*t*(p3.x - p2.x);
  const qpy = 3*u*u*(p1.y - p0.y) + 6*u*t*(p2.y - p1.y) + 3*t*t*(p3.y - p2.y);
  const qppx = 6*u*(p2.x - 2*p1.x + p0.x) + 6*t*(p3.x - 2*p2.x + p1.x);
  const qppy = 6*u*(p2.y - 2*p1.y + p0.y) + 6*t*(p3.y - 2*p2.y + p1.y);
  const dx = qx - p.x;
  const dy = qy - p.y;
  const numerator = dx * qpx + dy * qpy;
  const denominator = qpx * qpx + qpy * qpy + dx * qppx + dy * qppy;
  if (Math.abs(denominator) < 1e-12) return t;
  const next = t - numerator / denominator;
  if (next < 0) return 0;
  if (next > 1) return 1;
  return next;
}

function sub(a: SchneiderPoint, b: SchneiderPoint): SchneiderPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}
function dist(a: SchneiderPoint, b: SchneiderPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function unit(v: SchneiderPoint): SchneiderPoint {
  const m = Math.hypot(v.x, v.y);
  if (m === 0) return { x: 0, y: 0 };
  return { x: v.x / m, y: v.y / m };
}

function emitStraightCubic(
  b: PathBuilder,
  a: SchneiderPoint,
  c: SchneiderPoint,
): void {
  // cp1 at 1/3 along chord, cp2 at 2/3 — the canonical straight cubic.
  const cp1x = a.x + (c.x - a.x) / 3;
  const cp1y = a.y + (c.y - a.y) / 3;
  const cp2x = a.x + (2 * (c.x - a.x)) / 3;
  const cp2y = a.y + (2 * (c.y - a.y)) / 3;
  b.curveTo(cp1x, cp1y, cp2x, cp2y, c.x, c.y);
}
