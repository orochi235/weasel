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

  const fitted = fitOneCubic(samples);
  b.curveTo(fitted.cp1.x, fitted.cp1.y, fitted.cp2.x, fitted.cp2.y, fitted.end.x, fitted.end.y);
  void errorTolerance;
  return b.build();
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

  // Tangents at endpoints — unit vectors along (samples[1] - samples[0])
  // and (samples[n-2] - samples[n-1]). The end-tangent points "inward"
  // toward the start, matching the sign convention of the basis-Bezier
  // derivation (control-point distance is positive along tangent).
  const tStart = unit(sub(samples[1], a));
  const tEnd = unit(sub(samples[n - 2], e));

  // Chord-length parameterization
  const ts = new Array<number>(n);
  ts[0] = 0;
  let totalChord = 0;
  for (let i = 1; i < n; i++) {
    totalChord += dist(samples[i - 1], samples[i]);
    ts[i] = totalChord;
  }
  if (totalChord === 0) {
    return { cp1: { ...a }, cp2: { ...e }, end: e };
  }
  for (let i = 0; i < n; i++) ts[i] /= totalChord;

  // Closed-form 2×2 LS solve for the two scalar distances α1, α2 along
  // the tangents that minimize sum_i |C(t_i) - P_i|^2, with endpoints
  // fixed at samples[0] and samples[n-1].
  let c11 = 0, c12 = 0, c22 = 0;
  let x1 = 0, x2 = 0;
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
    alpha1 = alpha2 = totalChord / 3;
  } else {
    alpha1 = (c22 * x1 - c12 * x2) / det;
    alpha2 = (c11 * x2 - c12 * x1) / det;
    if (alpha1 < 1e-6 || alpha2 < 1e-6) {
      alpha1 = alpha2 = totalChord / 3;
    }
  }

  return {
    cp1: { x: a.x + tStart.x * alpha1, y: a.y + tStart.y * alpha1 },
    cp2: { x: e.x + tEnd.x * alpha2, y: e.y + tEnd.y * alpha2 },
    end: e,
  };
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
