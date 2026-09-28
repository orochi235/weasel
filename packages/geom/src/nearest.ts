/**
 * Nearest point on a segment or a whole path to a probe point: where it is,
 * its curve parameter, and how far away it lies.
 */
import { cubicEvalAt, elevateQuadraticToCubic } from './curve';
import { forEachSegment, PATH_M, PATH_L, PATH_Q, PATH_C, PATH_Z } from './commands';

/** The point on one segment nearest a probe. */
export interface CurveNearest {
  x: number;
  y: number;
  /** Curve parameter of the point, in [0, 1]. */
  t: number;
  /** Euclidean distance from the probe. */
  dist: number;
}

/** The point on a path nearest a probe, and the command whose segment holds it. */
export interface PathNearest extends CurveNearest {
  /** Index of the segment's command in the command stream (`L`, `Q`, `C` or `Z`). */
  commandIndex: number;
  /** Offset of that command's first coord; for a `Z`, where its coords would begin. */
  coordIndex: number;
}

/** Nearest point on segment (x0,y0)-(x1,y1) to (px,py). */
export function nearestOnLine(
  px: number, py: number, x0: number, y0: number, x1: number, y1: number,
): CurveNearest {
  const vx = x1 - x0, vy = y1 - y0;
  const vv = vx * vx + vy * vy;
  let t = vv === 0 ? 0 : ((px - x0) * vx + (py - y0) * vy) / vv;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = t === 1 ? x1 : x0 + t * vx;
  const y = t === 1 ? y1 : y0 + t * vy;
  return { x, y, t, dist: Math.hypot(px - x, py - y) };
}

/** Coarse samples per cubic. Each local minimum among them is refined, so this
 *  only has to separate the distance function's minima (a cubic has at most
 *  three), not locate them. */
const CUBIC_SAMPLES = 32;
const REFINE_ITERS = 40;
const T_EPS = 1e-14;

/**
 * Nearest point on the cubic (x0,y0)…(x3,y3) to (px,py). Samples the curve,
 * then refines every sampled local minimum with bracketed Newton on the
 * distance derivative, so a loop or cusp cannot capture it in the wrong basin.
 */
export function nearestOnCubic(
  px: number, py: number,
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
): CurveNearest {
  // Power basis B(t) = a t³ + b t² + c t + p0, for the derivatives.
  const ax = -x0 + 3 * x1 - 3 * x2 + x3, ay = -y0 + 3 * y1 - 3 * y2 + y3;
  const bx = 3 * x0 - 6 * x1 + 3 * x2, by = 3 * y0 - 6 * y1 + 3 * y2;
  const cx = 3 * (x1 - x0), cy = 3 * (y1 - y0);

  const d2At = (t: number): number => {
    const [x, y] = cubicEvalAt(x0, y0, x1, y1, x2, y2, x3, y3, t);
    return (x - px) ** 2 + (y - py) ** 2;
  };

  const d2s: number[] = [];
  for (let k = 0; k <= CUBIC_SAMPLES; k++) d2s.push(d2At(k / CUBIC_SAMPLES));

  let bestT = 0, bestD2 = d2s[0];
  for (let k = 0; k <= CUBIC_SAMPLES; k++) {
    const d = d2s[k];
    const prev = k > 0 ? d2s[k - 1] : Infinity;
    const next = k < CUBIC_SAMPLES ? d2s[k + 1] : Infinity;
    if (!(d <= prev && d <= next)) continue;

    let lo = Math.max(0, (k - 1) / CUBIC_SAMPLES);
    let hi = Math.min(1, (k + 1) / CUBIC_SAMPLES);
    let t = k / CUBIC_SAMPLES;
    for (let i = 0; i < REFINE_ITERS; i++) {
      const t2 = t * t;
      const ex = ax * t2 * t + bx * t2 + cx * t + x0 - px;
      const ey = ay * t2 * t + by * t2 + cy * t + y0 - py;
      const dx = 3 * ax * t2 + 2 * bx * t + cx, dy = 3 * ay * t2 + 2 * by * t + cy;
      const ddx = 6 * ax * t + 2 * bx, ddy = 6 * ay * t + 2 * by;
      // g = ½ d/dt |B - P|², zero at a critical point; its sign says which side the minimum is on.
      const g = ex * dx + ey * dy;
      const gp = dx * dx + dy * dy + ex * ddx + ey * ddy;
      if (g > 0) hi = t; else if (g < 0) lo = t; else break;
      let tn = gp > 0 ? t - g / gp : NaN;
      if (!(tn > lo && tn < hi)) tn = (lo + hi) / 2;
      const step = Math.abs(tn - t);
      t = tn;
      if (step < T_EPS || hi - lo < T_EPS) break;
    }
    const refined = d2At(t);
    const [tk, dk] = refined <= d ? [t, refined] : [k / CUBIC_SAMPLES, d];
    if (dk < bestD2) { bestD2 = dk; bestT = tk; }
  }

  const [x, y] = cubicEvalAt(x0, y0, x1, y1, x2, y2, x3, y3, bestT);
  return { x, y, t: bestT, dist: Math.hypot(x - px, y - py) };
}

/** Nearest point on the quadratic (x0,y0)(x1,y1)(x2,y2) to (px,py). */
export function nearestOnQuadratic(
  px: number, py: number,
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
): CurveNearest {
  // Degree elevation keeps the parameterization, so t carries over unchanged.
  const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(x0, y0, x1, y1, x2, y2);
  return nearestOnCubic(px, py, x0, y0, c1x, c1y, c2x, c2y, x2, y2);
}

/**
 * Nearest point on a command-stream path to (px,py), over every `L`, `Q`, `C`
 * and the closing edge each `Z` draws. The earliest segment wins a tie.
 * Returns `null` when the path has no segment, and throws on a command code
 * `PATH_COMMANDS` does not declare.
 */
export function nearestOnPath(
  commands: ArrayLike<number>,
  coords: ArrayLike<number>,
  px: number,
  py: number,
): PathNearest | null {
  let best: PathNearest | null = null;
  let startX = 0, startY = 0;
  forEachSegment(commands, coords, (cmd, ci, x0, y0, commandIndex) => {
    let hit: CurveNearest;
    if (cmd === PATH_M) {
      startX = coords[ci]; startY = coords[ci + 1];
      return;
    } else if (cmd === PATH_L) {
      hit = nearestOnLine(px, py, x0, y0, coords[ci], coords[ci + 1]);
    } else if (cmd === PATH_Q) {
      hit = nearestOnQuadratic(px, py, x0, y0, coords[ci], coords[ci + 1], coords[ci + 2], coords[ci + 3]);
    } else if (cmd === PATH_C) {
      hit = nearestOnCubic(
        px, py, x0, y0,
        coords[ci], coords[ci + 1], coords[ci + 2], coords[ci + 3], coords[ci + 4], coords[ci + 5],
      );
    } else if (cmd === PATH_Z) {
      hit = nearestOnLine(px, py, x0, y0, startX, startY);
    } else {
      throw new Error(`nearestOnPath: unknown command code ${cmd}`);
    }
    if (best === null || hit.dist < best.dist) best = { ...hit, commandIndex, coordIndex: ci };
  });
  return best;
}
