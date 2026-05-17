import type { BaseModule } from './types';
import { polygonSampler } from './polygonSampler';

/**
 * 8-fold-symmetric polar shape. The whole silhouette is defined by a single curve r(s)
 * over s ∈ [0, 1], where s=0 is the cardinal direction and s=1 is the diagonal. The full
 * shape comes from reflecting that octant curve eight times around the center. The curve
 * itself is two superellipse segments meeting at a valley:
 *
 *   s ∈ [0, valleyAt]      → spike segment, from `spikeR` down to `valleyR`
 *   s ∈ [valleyAt, 1]      → lobe segment, from `valleyR` up to `lobeR`
 *
 * Each segment has its own curvature, bend bias, and tip-erosion controls.
 */
export interface QuatrefoilParams {
  /** Radius at s=0 (cardinal direction). */
  spikeR?: number;
  /** Radius at s=1 (diagonal direction). */
  lobeR?: number;
  /** Radius at the junction between spike and lobe segments. */
  valleyR?: number;
  /** Position of the junction in [0, 1]. 0.5 = symmetric octant; <0.5 narrows the spike side. */
  valleyAt?: number;
  /** Spike-segment curvature (superellipse exponent). 1 = flat diagonal sides; <1 caves
   *  inward (concave/star); >1 bulges outward (convex/square-shouldered). */
  spikeCurvature?: number;
  /** Spike-segment bend bias. Positive shifts the curve's bend toward the tip; negative
   *  toward the base. */
  spikeBend?: number;
  /** Flat-top truncation of the cardinal tip (0..1). */
  spikeTipErosion?: number;
  /** Lobe-segment curvature, same semantics as spike. */
  lobeCurvature?: number;
  /** Lobe-segment bend bias. */
  lobeBend?: number;
  /** Flat-top truncation of the diagonal lobe peak (0..1). */
  lobeTipErosion?: number;
  /** Smooth the corner at the valley junction. 0 = sharp, higher = puffier crossover. */
  valleySmooth?: number;
  /** Rotate the pattern in degrees. */
  rotation?: number;
  /** Polygon sample count. */
  samples?: number;
}

const DEFAULTS: Required<QuatrefoilParams> = {
  spikeR: 50,
  lobeR: 42,
  valleyR: 25,
  valleyAt: 0.5,
  spikeCurvature: 1,
  spikeBend: 0,
  spikeTipErosion: 0,
  lobeCurvature: 1,
  lobeBend: 0,
  lobeTipErosion: 0,
  valleySmooth: 3,
  rotation: 0,
  samples: 192,
};

function smoothMax(a: number, b: number, g: number): number {
  const d = a - b;
  return (a + b + Math.sqrt(d * d + g * g)) / 2;
}

/** Generalised superellipse-style profile from (0, 0) to (1, 1) with asymmetric exponents
 *  controlled by curvature and bend. erosion truncates the top of the curve. */
function curveSegment(t: number, curvature: number, bend: number, erosion: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1 - erosion;
  const expA = Math.max(0.1, curvature * (1 + bend));
  const expB = Math.max(0.1, curvature * (1 - bend));
  const v = Math.pow(1 - Math.pow(1 - t, expA), 1 / expB);
  return Math.min(v, 1 - erosion);
}

export function quatrefoilVertices(params: QuatrefoilParams = {}): [number, number][] {
  const cfg = { ...DEFAULTS, ...params };
  const spike = Math.max(5, Math.min(cfg.spikeR, 50));
  const lobe = Math.max(5, Math.min(cfg.lobeR, 50 * Math.SQRT2));
  const valley = Math.max(0, Math.min(cfg.valleyR, Math.min(spike, lobe)));
  const vAt = Math.max(0.05, Math.min(cfg.valleyAt, 0.95));
  const sCurv = Math.max(0.2, cfg.spikeCurvature);
  const sBend = Math.max(-0.95, Math.min(cfg.spikeBend, 0.95));
  const sErode = Math.max(0, Math.min(cfg.spikeTipErosion, 1));
  const lCurv = Math.max(0.2, cfg.lobeCurvature);
  const lBend = Math.max(-0.95, Math.min(cfg.lobeBend, 0.95));
  const lErode = Math.max(0, Math.min(cfg.lobeTipErosion, 1));
  const smooth = Math.max(0, cfg.valleySmooth);
  const rot = (cfg.rotation * Math.PI) / 180;
  const N = Math.max(24, Math.floor(cfg.samples));
  const cx = 50, cy = 50;
  const verts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const θ = (i / N) * 2 * Math.PI;
    const s = Math.abs(Math.sin(2 * (θ - rot))); // 0..1 across each octant
    // t1: spike-side parameter, 1 at cardinal (s=0), 0 at valley (s=vAt). Clamped to ≥ 0.
    const t1 = (vAt - s) / vAt;
    // t2: lobe-side parameter, 0 at valley (s=vAt), 1 at diagonal (s=1). Clamped to ≥ 0.
    const t2 = (s - vAt) / (1 - vAt);
    const rSpike = valley + (spike - valley) * curveSegment(Math.max(0, t1), sCurv, sBend, sErode);
    const rLobe  = valley + (lobe  - valley) * curveSegment(Math.max(0, t2), lCurv, lBend, lErode);
    // Smooth corner at the valley: outside the smoothing band both rSpike and rLobe equal
    // `valley` on the inactive side, so smoothMax just picks the active one. Near the join
    // both are close to valley and smoothMax lifts the corner.
    const r = smoothMax(rSpike, rLobe, smooth);
    verts.push([cx + r * Math.cos(θ), cy + r * Math.sin(θ)]);
  }
  return verts;
}

const Quatrefoil: BaseModule<QuatrefoilParams> = {
  build: (params, boxW, boxH) => polygonSampler(quatrefoilVertices(params), boxW, boxH),
  defaults: DEFAULTS,
  insets: { top: 10, right: 14, bottom: 10, left: 14 },
};

export default Quatrefoil;
