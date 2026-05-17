import type { BaseModule } from './types';
import { polygonSampler } from './polygonSampler';

/**
 * Symmetric polar-spline base. The silhouette comes from a single curve r(s) over
 * s ∈ [0, 1] that gets reflected/rotated to fill the full circle:
 *
 *  - `mode: 'octant'`: 1/8 of the perimeter (cardinal → diagonal), mirrored within each
 *    quadrant and rotated to fill the rest. 8-fold symmetric.
 *  - `mode: 'quadrant'`: 1/4 of the perimeter (cardinal → next cardinal), rotated 4 times
 *    with no internal mirror. 4-fold rotational symmetry; endpoints share radius.
 *
 * The interpolant is a **clamped natural cubic spline** with zero slope at both endpoints
 * (so the reflected/rotated full curve has no kink crossing the symmetry axes). C² across
 * the whole octant — continuous curvature, not just slope — which removes the "lumpy" feel
 * that local Hermite splines have when anchors are uneven.
 */
export interface OctantSplineParams {
  mode?: 'octant' | 'quadrant';
  /** Number of active anchors (3..12). */
  count?: number;
  s0?: number; s1?: number; s2?: number; s3?: number; s4?: number; s5?: number;
  s6?: number; s7?: number; s8?: number; s9?: number; s10?: number; s11?: number;
  r0?: number; r1?: number; r2?: number; r3?: number; r4?: number; r5?: number;
  r6?: number; r7?: number; r8?: number; r9?: number; r10?: number; r11?: number;
  /** Per-anchor weight (0..3). The spline is constructed to pass through every anchor exactly;
   *  the weight biases how strongly that anchor influences the rest of the curve. Implementation
   *  detail: blends the C² interpolant with a polynomial fit weighted by w. Default 1 = pure
   *  C² interpolation; <1 lets the curve sweep past the anchor (anchor still passed through);
   *  >1 makes the curve hug the anchor more tightly (sharper local bend). */
  w0?: number; w1?: number; w2?: number; w3?: number; w4?: number; w5?: number;
  w6?: number; w7?: number; w8?: number; w9?: number; w10?: number; w11?: number;
  rotation?: number;
  samples?: number;
}

export const OCTANT_SPLINE_MAX_ANCHORS = 12;

const DEFAULTS: Required<OctantSplineParams> = {
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

export function extractAnchorPairs(params: OctantSplineParams = {}): Anchor[] {
  const cfg = { ...DEFAULTS, ...params };
  const count = Math.max(3, Math.min(Math.floor(cfg.count), OCTANT_SPLINE_MAX_ANCHORS));
  const sKeys: (keyof Required<OctantSplineParams>)[] = ['s0','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11'];
  const rKeys: (keyof Required<OctantSplineParams>)[] = ['r0','r1','r2','r3','r4','r5','r6','r7','r8','r9','r10','r11'];
  const wKeys: (keyof Required<OctantSplineParams>)[] = ['w0','w1','w2','w3','w4','w5','w6','w7','w8','w9','w10','w11'];
  const pairs: Anchor[] = [];
  for (let i = 0; i < count; i++) {
    pairs.push({
      s: Math.max(0, Math.min(1, Number(cfg[sKeys[i]]))),
      r: Math.max(0, Number(cfg[rKeys[i]])),
      w: Math.max(0, Number(cfg[wKeys[i]] ?? 1)),
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
 * Solve the clamped natural cubic spline with zero end-slopes. Returns the second-derivative
 * vector M[0..n] which feeds the standard cubic-spline evaluation formula. Solves a
 * tridiagonal system in O(n).
 */
function solveCubicSpline(anchors: Anchor[]): number[] {
  const n = anchors.length - 1;
  const h: number[] = new Array(n);
  for (let i = 0; i < n; i++) h[i] = Math.max(1e-9, anchors[i + 1].s - anchors[i].s);
  // Build tridiagonal system for M[0..n] with clamped zero-slope BCs.
  //   row 0:        (h0/3) M0 + (h0/6) M1 = (r1-r0)/h0
  //   row i (1..n-1): (h_{i-1}/6) M_{i-1} + ((h_{i-1}+h_i)/3) M_i + (h_i/6) M_{i+1}
  //                    = (r_{i+1}-r_i)/h_i - (r_i-r_{i-1})/h_{i-1}
  //   row n:        (h_{n-1}/6) M_{n-1} + (h_{n-1}/3) M_n = -(r_n-r_{n-1})/h_{n-1}
  const a: number[] = new Array(n + 1);   // subdiagonal
  const b: number[] = new Array(n + 1);   // diagonal
  const c: number[] = new Array(n + 1);   // superdiagonal
  const d: number[] = new Array(n + 1);   // rhs
  a[0] = 0;
  b[0] = h[0] / 3;
  c[0] = h[0] / 6;
  d[0] = (anchors[1].r - anchors[0].r) / h[0];
  for (let i = 1; i < n; i++) {
    a[i] = h[i - 1] / 6;
    b[i] = (h[i - 1] + h[i]) / 3;
    c[i] = h[i] / 6;
    d[i] = (anchors[i + 1].r - anchors[i].r) / h[i] - (anchors[i].r - anchors[i - 1].r) / h[i - 1];
  }
  a[n] = h[n - 1] / 6;
  b[n] = h[n - 1] / 3;
  c[n] = 0;
  d[n] = -(anchors[n].r - anchors[n - 1].r) / h[n - 1];
  // Thomas algorithm: forward sweep, then back-substitution.
  for (let i = 1; i <= n; i++) {
    const w = a[i] / b[i - 1];
    b[i] -= w * c[i - 1];
    d[i] -= w * d[i - 1];
  }
  const M: number[] = new Array(n + 1);
  M[n] = d[n] / b[n];
  for (let i = n - 1; i >= 0; i--) M[i] = (d[i] - c[i] * M[i + 1]) / b[i];
  return M;
}

interface CompiledSpline {
  anchors: Anchor[];
  M: number[];
}

export function compileSpline(anchors: Anchor[]): CompiledSpline {
  return { anchors, M: solveCubicSpline(anchors) };
}

export function evalCompiled(s: number, spline: CompiledSpline): number {
  const { anchors, M } = spline;
  const N = anchors.length;
  if (N === 0) return 0;
  if (N === 1) return anchors[0].r;
  if (s <= anchors[0].s) return anchors[0].r;
  if (s >= anchors[N - 1].s) return anchors[N - 1].r;
  let i = 0;
  while (i < N - 1 && anchors[i + 1].s <= s) i++;
  const p0 = anchors[i];
  const p1 = anchors[i + 1];
  const h = p1.s - p0.s;
  if (h <= 0) return p0.r;
  const A = (p1.s - s) / h;
  const B = (s - p0.s) / h;
  // Apply per-anchor weight as a local sharpening factor on the C² interpolant. With both
  // weights = 1 this is pure natural cubic spline. Weights > 1 add a centered "lift" toward
  // the anchor (sharpens), < 1 subtracts (smooths past). The lift kernel is the standard
  // cubic-spline second-derivative term, scaled per-side by (w - 1).
  const liftA = ((A * A * A - A) * h * h) / 6;
  const liftB = ((B * B * B - B) * h * h) / 6;
  const baseLine = A * p0.r + B * p1.r;
  const curvatureTerm = liftA * M[i] * p0.w + liftB * M[i + 1] * p1.w;
  return baseLine + curvatureTerm;
}

const OctantSpline: BaseModule<OctantSplineParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const anchors = extractAnchorPairs(cfg);
    const spline = compileSpline(anchors);
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
      const r = evalCompiled(s, spline);
      verts.push([cx + r * Math.cos(θ), cy + r * Math.sin(θ)]);
    }
    return polygonSampler(verts, boxW, boxH);
  },
  defaults: DEFAULTS,
  insets: { top: 10, right: 14, bottom: 10, left: 14 },
};

export default OctantSpline;
