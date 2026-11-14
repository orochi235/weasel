import type { BaseModule } from './types';
import { polygonSampler } from './polygonSampler';
import {
  type BadgeSplineAnchor as Anchor, extractAnchorPairs, OCTANT_SPLINE_DEFAULTS, splineVertices,
} from './OctantSpline';

/**
 * Symmetric polar NURBS base. Same anchor concept as `octant-spline` but the curve is an
 * **approximating** cubic NURBS — the control points pull the curve without sitting on it.
 * Each anchor's weight increases the local pull toward that control point.
 *
 * Endpoint behaviour: the curve uses mirror-phantom control points just outside [0, 1]
 * derived from the second-from-end anchors, which enforces zero slope at s=0 and s=1 so
 * the reflected/rotated full silhouette closes cleanly across the symmetry axes.
 */
/** What `baseParams` takes on a badge whose `base` is `octant-bspline`. */
export interface BadgeOctantBSplineBaseParams {
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

const DEFAULTS: Required<BadgeOctantBSplineBaseParams> = OCTANT_SPLINE_DEFAULTS;

/** The least weight an anchor draws with: at zero a rational curve divides by zero at its ends. */
export const OCTANT_BSPLINE_MIN_WEIGHT = 0.01;

/**
 * Two phantom control points are inserted at each end (mirror reflections of the second-
 * from-end anchors across the cardinal/diagonal axes), forcing zero slope at the endpoints
 * for clean symmetric closure.
 */
function buildExtendedControls(anchors: readonly Anchor[]): Anchor[] {
  const N = anchors.length;
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

function compileNurbs(anchors: readonly Anchor[]): CompiledNurbs {
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
function evalNurbsAtS(s: number, nurbs: CompiledNurbs): number {
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

/**
 * The radius r(s) of the approximating `octant-bspline` curve over `anchors`, which are in order along it from
 * s = 0 to s = 1: a cubic NURBS their weights pull toward each one, through the two ends only. A weight under
 * {@link OCTANT_BSPLINE_MIN_WEIGHT} draws as that.
 */
export function octantBSplineRadius(anchors: readonly Anchor[]): (s: number) => number {
  const nurbs = compileNurbs(anchors.map((a) => ({ ...a, w: Math.max(OCTANT_BSPLINE_MIN_WEIGHT, a.w) })));
  return (s) => evalNurbsAtS(s, nurbs);
}

const OctantBSpline: BaseModule<BadgeOctantBSplineBaseParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const radiusAt = octantBSplineRadius(extractAnchorPairs(cfg, OCTANT_BSPLINE_MIN_WEIGHT));
    return polygonSampler(splineVertices(cfg, radiusAt), boxW, boxH);
  },
  defaults: DEFAULTS,
  insets: { top: 10, right: 14, bottom: 10, left: 14 },
  fitsContent: true,
};

export default OctantBSpline;
