import type { EffectModule } from '../bases/types';
import { rangeMask, type RangeMaskParams } from './rangeMask';

export interface SpikesEffectParams extends RangeMaskParams {
  count?: number;
  length?: number;
  baseWidth?: number;
  vertScale?: number;
  horzScale?: number;
  diagonalScale?: number;
  irregularity?: number;
  /**
   * 0..1 strength of curvature-based shortening on corners. At 1 we fully cancel the tip-arc
   * expansion `(1 + κL)` so neighbouring spike tips stay roughly evenly spaced even on tight
   * corner arcs; at 0 spikes are constant length and visibly fan outward around corners.
   */
  cornerCompensation?: number;
}

const DEFAULTS: Required<SpikesEffectParams> = {
  count: 44,
  length: 8,
  baseWidth: 3,
  vertScale: 1.4,
  horzScale: 1,
  diagonalScale: 0.5,
  irregularity: 0,
  cornerCompensation: 1,
};

const Spikes: EffectModule<SpikesEffectParams> = {
  offsetAt: (s, { params, phase, totalCss, perimeterAt }) => {
    const cfg = { ...DEFAULTS, ...params };
    const mask = rangeMask(s, totalCss, cfg.range);
    if (mask === 0) return { dx: 0, dy: 0 };
    const N = Math.max(3, Math.floor(cfg.count));
    const step = totalCss / N;
    const halfBase = Math.max(0.1, Math.min(step / 2 - 0.05, cfg.baseWidth / 2));
    const phaseOffset = phase * step;
    // Find the nearest spike center on the unwrapped axis, then wrap.
    const sm = ((s % totalCss) + totalCss) % totalCss;
    const i = Math.round((sm - phaseOffset) / step);
    const sc = ((i * step + phaseOffset) % totalCss + totalCss) % totalCss;
    // Use shortest-distance metric on a closed perimeter.
    let ds = sm - sc;
    if (ds > totalCss / 2) ds -= totalCss;
    if (ds < -totalCss / 2) ds += totalCss;
    if (Math.abs(ds) > halfBase) return { dx: 0, dy: 0 };
    // Triangular: peak at ds=0, zero at the base edges.
    const t = 1 - Math.abs(ds) / halfBase;
    const pCenter = perimeterAt(sc);
    // Use the actual perimeter normal — no 45° quantization, so spike angles
    // sweep smoothly through corner arcs.
    const dirX = pCenter.nx;
    const dirY = pCenter.ny;
    // Smoothly blend axis (vert/horz) and diagonal scales by how diagonal the
    // normal points. d = |sin(2θ)| ∈ [0,1]: 0 on the cardinal axes, 1 at 45°.
    const nxAbs = Math.abs(pCenter.nx);
    const nyAbs = Math.abs(pCenter.ny);
    const d = Math.min(1, 2 * nxAbs * nyAbs);
    const axisScale = nyAbs > nxAbs ? cfg.vertScale : cfg.horzScale;
    const scale = axisScale * (1 - d) + cfg.diagonalScale * d;
    const irrMult = 1 + cfg.irregularity * 0.5 * Math.sin(i * 1.73 + 0.7);
    // Numerical curvature κ ≈ |dn/ds| in CSS units. We average over a window roughly the
    // size of a spike footprint so the corner's influence smoothly bleeds onto adjacent
    // flat-edge samples instead of switching off at the arc boundary.
    const eps = Math.max(step * 0.5, halfBase);
    const SAMPLES = 5;
    let kappa = 0;
    for (let k = 0; k < SAMPLES; k++) {
      const u = (k + 0.5) / SAMPLES; // 0..1 across the window
      const sA = sc - eps + u * 2 * eps - eps / SAMPLES;
      const sB = sc - eps + u * 2 * eps + eps / SAMPLES;
      const pA = perimeterAt(sA);
      const pB = perimeterAt(sB);
      kappa += Math.hypot(pB.nx - pA.nx, pB.ny - pA.ny) / (sB - sA);
    }
    kappa /= SAMPLES;
    const baseLen = cfg.length * scale * irrMult * t;
    const comp = Math.max(0, Math.min(cfg.cornerCompensation, 1));
    const lenCss = Math.max(0, baseLen / (1 + comp * kappa * baseLen)) * mask;
    return { dx: dirX * lenCss, dy: dirY * lenCss };
  },
  defaults: DEFAULTS,
};

export default Spikes;
