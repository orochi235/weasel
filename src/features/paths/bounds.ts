/**
 * AABB bounds of a `Path`. Returned as `RectPath` for direct reuse with the
 * rect fast path machinery (selection AABB, area-select intersection).
 *
 * `RectPath` is its own bounds — O(1). For `PolygonPath`, walk segment by
 * segment, computing the tight bound per segment:
 *
 *   - `M` / `L`: just the endpoint.
 *   - `Q`: quadratic Bezier — endpoints plus axis-aligned extrema (one
 *     possible inflection per axis).
 *   - `C`: cubic Bezier — endpoints plus axis-aligned extrema (up to two
 *     possible inflections per axis, found via the quadratic formula on
 *     the derivative).
 *
 * Control points are NOT included directly; they're used only to compute
 * extrema that actually lie on the curve. This avoids the classic "AABB
 * extends past where the curve visibly reaches" bug for curved paths whose
 * control points poke outside the visible extent.
 *
 * Empty paths (no commands) return a zero-size rect anchored at the
 * origin — the convention used elsewhere in the kit for missing geometry.
 */

import {
  PATH_C,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  type Path,
  type RectPath,
} from './types';

/** AABB of a `Path`, returned as a `RectPath` for direct reuse with rect-fast-path machinery. */
export function boundsOfPath(path: Path): RectPath {
  if (path.kind === 'rect') return path;

  const { commands, coords } = path;
  if (commands.length === 0) {
    return { kind: 'rect', x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let ci = 0;
  let seen = false;
  // Pen position carried across segments — needed because curves are
  // defined relative to the previous endpoint, which is itself the start
  // of the next segment but not re-encoded in `coords`.
  let px = 0, py = 0;

  const include = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    seen = true;
  };

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd) {
      case PATH_M:
      case PATH_L: {
        const x = coords[ci], y = coords[ci + 1];
        include(x, y);
        px = x; py = y;
        ci += 2;
        break;
      }
      case PATH_C: {
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const x3 = coords[ci + 4], y3 = coords[ci + 5];
        includeCubicExtrema(px, py, x1, y1, x2, y2, x3, y3, include);
        px = x3; py = y3;
        ci += 6;
        break;
      }
      case PATH_Q: {
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        includeQuadraticExtrema(px, py, x1, y1, x2, y2, include);
        px = x2; py = y2;
        ci += 4;
        break;
      }
      case PATH_Z:
        break;
      default:
        throw new Error(`boundsOfPath: unknown command ${cmd}`);
    }
  }

  if (!seen) return { kind: 'rect', x: 0, y: 0, width: 0, height: 0 };
  return { kind: 'rect', x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

type Include = (x: number, y: number) => void;

/** Include the endpoints + any axis-aligned extrema of a cubic Bezier
 *  segment from (x0,y0) → (x3,y3) with controls (x1,y1)(x2,y2). */
function includeCubicExtrema(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  include: Include,
): void {
  // Endpoints are always on the curve.
  include(x0, y0);
  include(x3, y3);
  // Per axis: solve the derivative B'(t) = 0 for extrema in (0, 1).
  // B'(t) is quadratic: a t^2 + b t + c, with
  //   a = -p0 + 3p1 - 3p2 + p3
  //   b = 2(p0 - 2p1 + p2)
  //   c = -p0 + p1
  // (Standard cubic Bezier derivative coefficients.)
  for (const [p0, p1, p2, p3, axis] of [
    [x0, x1, x2, x3, 'x'] as const,
    [y0, y1, y2, y3, 'y'] as const,
  ]) {
    const a = -p0 + 3 * p1 - 3 * p2 + p3;
    const b = 2 * (p0 - 2 * p1 + p2);
    const c = -p0 + p1;
    for (const t of solveQuadratic(a, b, c)) {
      if (t <= 0 || t >= 1) continue;
      const v = evaluateCubic(p0, p1, p2, p3, t);
      // Include the extremum on the appropriate axis; for the other
      // axis at the same t, pass a value inside the current bounds so
      // include() doesn't expand it spuriously. Simpler: evaluate both
      // axes at this t.
      if (axis === 'x') {
        const y = evaluateCubic(y0, y1, y2, y3, t);
        include(v, y);
      } else {
        const x = evaluateCubic(x0, x1, x2, x3, t);
        include(x, v);
      }
    }
  }
}

/** Include the endpoints + any axis-aligned extremum of a quadratic
 *  Bezier from (x0,y0) → (x2,y2) with control (x1,y1). */
function includeQuadraticExtrema(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  include: Include,
): void {
  include(x0, y0);
  include(x2, y2);
  // B'(t) = 2 ( (1-t)(p1 - p0) + t(p2 - p1) ) = 0
  // → t = (p0 - p1) / (p0 - 2 p1 + p2)
  for (const [p0, p1, p2, axis] of [
    [x0, x1, x2, 'x'] as const,
    [y0, y1, y2, 'y'] as const,
  ]) {
    const denom = p0 - 2 * p1 + p2;
    if (denom === 0) continue;
    const t = (p0 - p1) / denom;
    if (t <= 0 || t >= 1) continue;
    const v = evaluateQuadratic(p0, p1, p2, t);
    if (axis === 'x') {
      const y = evaluateQuadratic(y0, y1, y2, t);
      include(v, y);
    } else {
      const x = evaluateQuadratic(x0, x1, x2, t);
      include(x, v);
    }
  }
}

function evaluateCubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function evaluateQuadratic(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

/** Real roots of a t² + b t + c. Returns [] for no real roots; handles
 *  the linear degenerate case (a == 0). */
function solveQuadratic(a: number, b: number, c: number): number[] {
  if (a === 0) {
    if (b === 0) return [];
    return [-c / b];
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  if (disc === 0) return [-b / (2 * a)];
  const sq = Math.sqrt(disc);
  return [(-b + sq) / (2 * a), (-b - sq) / (2 * a)];
}
