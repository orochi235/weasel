import type { CurveRepresentation, Discriminator, SharedAnchor } from './types';
import { PATH_L, PATH_M } from '../types';

const DEGREE = 3;
const WEIGHT_MIN = 1e-3;
const WEIGHT_MAX = 8;
const FLATTEN_SAMPLES = 64;

/** Build a uniform open knot vector. For n control points and degree p,
 *  knot vector length is n + p + 1: the first p+1 knots are 0, the last
 *  p+1 knots are 1, intermediate knots are evenly spaced. Standard
 *  "clamped" form so the curve passes through first and last anchors. */
function openUniformKnots(n: number, p = DEGREE): number[] {
  const m = n + p + 1;
  const knots: number[] = [];
  for (let i = 0; i < m; i++) {
    if (i <= p) knots.push(0);
    else if (i >= n) knots.push(1);
    else knots.push((i - p) / (n - p));
  }
  return knots;
}

function findSpan(n: number, p: number, u: number, knots: number[]): number {
  if (u >= knots[n]) return n - 1;
  if (u <= knots[p]) return p;
  let lo = p;
  let hi = n;
  let mid = (lo + hi) >> 1;
  while (u < knots[mid] || u >= knots[mid + 1]) {
    if (u < knots[mid]) hi = mid;
    else lo = mid;
    mid = (lo + hi) >> 1;
  }
  return mid;
}

function basisFunctions(i: number, u: number, p: number, knots: number[]): number[] {
  const N = new Array<number>(p + 1).fill(0);
  N[0] = 1;
  const left = new Array<number>(p + 1).fill(0);
  const right = new Array<number>(p + 1).fill(0);
  for (let j = 1; j <= p; j++) {
    left[j] = u - knots[i + 1 - j];
    right[j] = knots[i + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      const temp = N[r] / (right[r + 1] + left[j - r]);
      N[r] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    N[j] = saved;
  }
  return N;
}

function weightOf(a: SharedAnchor): number {
  const w = a.weight ?? 1;
  return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, w));
}

function evalNurbs(anchors: SharedAnchor[], u: number): { x: number; y: number } {
  const n = anchors.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { x: anchors[0].x, y: anchors[0].y };
  const p = Math.min(DEGREE, n - 1);
  const knots = openUniformKnots(n, p);
  const clamped = Math.min(Math.max(u, 0), 1);
  const span = findSpan(n, p, clamped, knots);
  const N = basisFunctions(span, clamped, p, knots);
  let wx = 0;
  let wy = 0;
  let wTotal = 0;
  for (let j = 0; j <= p; j++) {
    const idx = span - p + j;
    const a = anchors[idx];
    const w = weightOf(a);
    wx += N[j] * w * a.x;
    wy += N[j] * w * a.y;
    wTotal += N[j] * w;
  }
  if (wTotal < 1e-12) return { x: anchors[0].x, y: anchors[0].y };
  return { x: wx / wTotal, y: wy / wTotal };
}

/** NURBS: anchors act as weighted control points the curve is pulled toward rather than passing through. Flattened to line segments when converted to a path. */
export const nurbs: CurveRepresentation = {
  kind: 'nurbs',
  label: 'NURBS',
  evaluate(anchors, t) {
    return evalNurbs(anchors, t);
  },
  toPath(anchors) {
    if (anchors.length < 2) {
      return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
    }
    const cmds: number[] = [PATH_M];
    const xs: number[] = [];
    for (let s = 0; s <= FLATTEN_SAMPLES; s++) {
      const t = s / FLATTEN_SAMPLES;
      const p = evalNurbs(anchors, t);
      xs.push(p.x, p.y);
      if (s > 0) cmds.push(PATH_L);
    }
    return {
      kind: 'polygon',
      commands: new Uint8Array(cmds),
      coords: new Float32Array(xs),
      fillRule: 'nonzero',
    };
  },
  curvatureAt(anchors, t) {
    if (anchors.length < 2) return 0;
    const eps = 1e-3;
    const t0 = Math.max(0, t - eps);
    const t1 = Math.min(1, t + eps);
    const p0 = evalNurbs(anchors, t0);
    const p2 = evalNurbs(anchors, t1);
    const pm = evalNurbs(anchors, t);
    const d1x = (p2.x - p0.x) / (t1 - t0);
    const d1y = (p2.y - p0.y) / (t1 - t0);
    const d2x = (p2.x - 2 * pm.x + p0.x) / (eps * eps);
    const d2y = (p2.y - 2 * pm.y + p0.y) / (eps * eps);
    const num = d1x * d2y - d1y * d2x;
    const den = Math.pow(d1x * d1x + d1y * d1y, 1.5);
    if (den < 1e-12) return 0;
    return num / den;
  },
  discriminators(anchors) {
    const out: Discriminator[] = [];
    for (let i = 0; i < anchors.length; i++) {
      out.push({
        kind: 'slider',
        label: `w${i}`,
        anchorIndex: i,
        field: 'weight',
        min: WEIGHT_MIN,
        max: WEIGHT_MAX,
        step: 0.1,
        value: weightOf(anchors[i]),
      });
    }
    return out;
  },
};
