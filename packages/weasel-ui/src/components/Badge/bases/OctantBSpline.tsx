import type { BaseModule } from './types';
import { polygonSampler } from './polygonSampler';

/**
 * Symmetric polar NURBS base. Same anchor concept as `octant-spline` but the curve is an
 * **approximating** cubic NURBS — the control points pull the curve without sitting on it.
 * Each anchor's weight increases the local pull toward that control point.
 *
 * Endpoint behaviour: the curve uses mirror-phantom control points just outside [0, 1]
 * derived from the second-from-end anchors, which enforces zero slope at s=0 and s=1 so
 * the reflected/rotated full silhouette closes cleanly across the symmetry axes.
 */
export interface OctantBSplineParams {
  mode?: 'octant' | 'quadrant';
  count?: number;
  s0?: number; s1?: number; s2?: number; s3?: number; s4?: number; s5?: number;
  s6?: number; s7?: number; s8?: number; s9?: number; s10?: number; s11?: number;
  r0?: number; r1?: number; r2?: number; r3?: number; r4?: number; r5?: number;
  r6?: number; r7?: number; r8?: number; r9?: number; r10?: number; r11?: number;
  w0?: number; w1?: number; w2?: number; w3?: number; w4?: number; w5?: number;
  w6?: number; w7?: number; w8?: number; w9?: number; w10?: number; w11?: number;
  rotation?: number;
  samples?: number;
}

export const OCTANT_BSPLINE_MAX_ANCHORS = 12;

const DEFAULTS: Required<OctantBSplineParams> = {
  mode: 'octant',
  count: 5,
  s0: 0,    s1: 0.25, s2: 0.5,  s3: 0.75, s4: 1,    s5: 1,
  s6: 1,    s7: 1,    s8: 1,    s9: 1,    s10: 1,   s11: 1,
  r0: 48,   r1: 30,   r2: 32,   r3: 38,   r4: 46,   r5: 42,
  r6: 36,   r7: 32,   r8: 30,   r9: 30,   r10: 30,  r11: 30,
  w0: 1,    w1: 1,    w2: 1,    w3: 1,    w4: 1,    w5: 1,
  w6: 1,    w7: 1,    w8: 1,    w9: 1,    w10: 1,   w11: 1,
  rotation: 0,
  samples: 192,
};

interface Anchor { s: number; r: number; w: number }

export function extractAnchorPairs(params: OctantBSplineParams = {}): Anchor[] {
  const cfg = { ...DEFAULTS, ...params };
  const count = Math.max(3, Math.min(Math.floor(cfg.count), OCTANT_BSPLINE_MAX_ANCHORS));
  const sKeys: (keyof Required<OctantBSplineParams>)[] = ['s0','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11'];
  const rKeys: (keyof Required<OctantBSplineParams>)[] = ['r0','r1','r2','r3','r4','r5','r6','r7','r8','r9','r10','r11'];
  const wKeys: (keyof Required<OctantBSplineParams>)[] = ['w0','w1','w2','w3','w4','w5','w6','w7','w8','w9','w10','w11'];
  const pairs: Anchor[] = [];
  for (let i = 0; i < count; i++) {
    pairs.push({
      s: Math.max(0, Math.min(1, Number(cfg[sKeys[i]]))),
      r: Math.max(0, Number(cfg[rKeys[i]])),
      w: Math.max(0.01, Number(cfg[wKeys[i]] ?? 1)),
    });
  }
  pairs.sort((a, b) => a.s - b.s);
  pairs[0].s = 0;
  pairs[count - 1].s = 1;
  if (cfg.mode === 'quadrant') {
    pairs[count - 1].r = pairs[0].r;
    pairs[count - 1].w = pairs[0].w;
  }
  return pairs;
}

/**
 * Cubic NURBS evaluation. Returns r at parameter u ∈ [0, 1].
 *
 * Implementation uses (s_i, r_i, w_i) as control points and treats `u` as the underlying
 * curve parameter, with the knot vector clamped at both ends. Because the control points'
 * `s` coordinates are themselves part of the curve, we need a parametric formulation:
 *   S(u) = Σ w_i N_i(u) s_i / Σ w_i N_i(u)
 *   R(u) = Σ w_i N_i(u) r_i / Σ w_i N_i(u)
 * Then we invert S(u) = s to get u and read out R(u).
 *
 * Two phantom control points are inserted at each end (mirror reflections of the second-
 * from-end anchors across the cardinal/diagonal axes), forcing zero slope at the endpoints
 * for clean symmetric closure.
 */
function buildExtendedControls(anchors: Anchor[]): Anchor[] {
  const N = anchors.length;
  // Phantom controls outside [0, 1]. They are mirrored versions of the second-from-end
  // visible anchors. Symmetric reflection gives zero slope at the cardinal/diagonal endpoints.
  const phantomLeft1: Anchor = { s: -anchors[1].s, r: anchors[1].r, w: anchors[1].w };
  const phantomLeft2: Anchor = { s: -anchors[Math.min(2, N - 1)].s, r: anchors[Math.min(2, N - 1)].r, w: anchors[Math.min(2, N - 1)].w };
  const phantomRight1: Anchor = { s: 2 - anchors[N - 2].s, r: anchors[N - 2].r, w: anchors[N - 2].w };
  const phantomRight2: Anchor = { s: 2 - anchors[Math.max(N - 3, 0)].s, r: anchors[Math.max(N - 3, 0)].r, w: anchors[Math.max(N - 3, 0)].w };
  return [phantomLeft2, phantomLeft1, ...anchors, phantomRight1, phantomRight2];
}

function buildKnots(numCtrl: number, degree: number): number[] {
  // Clamped uniform knot vector of length numCtrl + degree + 1.
  const m = numCtrl + degree + 1;
  const knots: number[] = new Array(m);
  for (let i = 0; i <= degree; i++) knots[i] = 0;
  const interior = numCtrl - degree - 1;
  for (let i = 1; i <= interior; i++) knots[degree + i] = i / (interior + 1);
  for (let i = m - degree - 1; i < m; i++) knots[i] = 1;
  return knots;
}

function findSpan(u: number, knots: number[], degree: number, numCtrl: number): number {
  if (u >= knots[numCtrl]) return numCtrl - 1;
  if (u <= knots[degree]) return degree;
  let low = degree;
  let high = numCtrl;
  let mid = (low + high) >>> 1;
  while (u < knots[mid] || u >= knots[mid + 1]) {
    if (u < knots[mid]) high = mid;
    else low = mid;
    mid = (low + high) >>> 1;
  }
  return mid;
}

function basisFns(span: number, u: number, knots: number[], degree: number): number[] {
  const N: number[] = new Array(degree + 1).fill(0);
  const left: number[] = new Array(degree + 1);
  const right: number[] = new Array(degree + 1);
  N[0] = 1;
  for (let j = 1; j <= degree; j++) {
    left[j] = u - knots[span + 1 - j];
    right[j] = knots[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      const denom = right[r + 1] + left[j - r];
      const temp = denom === 0 ? 0 : N[r] / denom;
      N[r] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    N[j] = saved;
  }
  return N;
}

interface CompiledNurbs {
  extended: Anchor[];
  knots: number[];
  degree: number;
}

export function compileNurbs(anchors: Anchor[]): CompiledNurbs {
  const extended = buildExtendedControls(anchors);
  const degree = 3;
  const knots = buildKnots(extended.length, degree);
  return { extended, knots, degree };
}

function evalNurbsAtU(u: number, nurbs: CompiledNurbs): { s: number; r: number } {
  const { extended, knots, degree } = nurbs;
  const numCtrl = extended.length;
  const uClamped = Math.max(0, Math.min(1, u));
  const span = findSpan(uClamped, knots, degree, numCtrl);
  const N = basisFns(span, uClamped, knots, degree);
  let sNum = 0;
  let rNum = 0;
  let wSum = 0;
  for (let i = 0; i <= degree; i++) {
    const ctrl = extended[span - degree + i];
    const wn = ctrl.w * N[i];
    sNum += wn * ctrl.s;
    rNum += wn * ctrl.r;
    wSum += wn;
  }
  return wSum > 0 ? { s: sNum / wSum, r: rNum / wSum } : { s: 0, r: 0 };
}

/** Invert S(u) = s by bisection. The NURBS is monotonic in s because the underlying knot
 *  vector and control sequence are monotonic, so bisection converges quickly. */
export function evalNurbsAtS(s: number, nurbs: CompiledNurbs): number {
  if (s <= 0) return evalNurbsAtU(0, nurbs).r;
  if (s >= 1) return evalNurbsAtU(1, nurbs).r;
  let lo = 0, hi = 1;
  for (let iter = 0; iter < 30; iter++) {
    const mid = (lo + hi) * 0.5;
    const { s: sMid } = evalNurbsAtU(mid, nurbs);
    if (sMid < s) lo = mid; else hi = mid;
    if (hi - lo < 1e-5) break;
  }
  return evalNurbsAtU((lo + hi) * 0.5, nurbs).r;
}

const OctantBSpline: BaseModule<OctantBSplineParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const anchors = extractAnchorPairs(cfg);
    const nurbs = compileNurbs(anchors);
    const rot = (cfg.rotation * Math.PI) / 180;
    const N = Math.max(48, Math.floor(cfg.samples));
    const cx = 50, cy = 50;
    const verts: [number, number][] = [];
    const HALF_PI = Math.PI / 2;
    for (let i = 0; i < N; i++) {
      const θ = (i / N) * 2 * Math.PI;
      const θRel = θ - rot;
      let s: number;
      if (cfg.mode === 'quadrant') {
        const θQ = ((θRel % HALF_PI) + HALF_PI) % HALF_PI;
        s = θQ / HALF_PI;
      } else {
        s = Math.abs(Math.sin(2 * θRel));
      }
      const r = evalNurbsAtS(s, nurbs);
      verts.push([cx + r * Math.cos(θ), cy + r * Math.sin(θ)]);
    }
    return polygonSampler(verts, boxW, boxH);
  },
  defaults: DEFAULTS,
  insets: { top: 10, right: 14, bottom: 10, left: 14 },
};

export default OctantBSpline;
