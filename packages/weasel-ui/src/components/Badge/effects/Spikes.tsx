import type { EffectModule } from '../bases/types';

export interface SpikesEffectParams {
  count?: number;
  length?: number;
  baseWidth?: number;
  vertScale?: number;
  horzScale?: number;
  diagonalScale?: number;
  irregularity?: number;
}

const DEFAULTS: Required<SpikesEffectParams> = {
  count: 44,
  length: 8,
  baseWidth: 3,
  vertScale: 1.4,
  horzScale: 1,
  diagonalScale: 0.5,
  irregularity: 0,
};

const Spikes: EffectModule<SpikesEffectParams> = {
  offsetAt: (s, { params, phase, totalCss, perimeterAt }) => {
    const cfg = { ...DEFAULTS, ...params };
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
    const nxAbs = Math.abs(pCenter.nx);
    const nyAbs = Math.abs(pCenter.ny);
    const onDiagonal = nxAbs > 0.05 && nyAbs > 0.05;
    const dirX = onDiagonal ? Math.sign(pCenter.nx) / Math.SQRT2 : pCenter.nx;
    const dirY = onDiagonal ? Math.sign(pCenter.ny) / Math.SQRT2 : pCenter.ny;
    const scale = onDiagonal ? cfg.diagonalScale : (nyAbs > nxAbs ? cfg.vertScale : cfg.horzScale);
    const irrMult = 1 + cfg.irregularity * 0.5 * Math.sin(i * 1.73 + 0.7);
    const lenCss = Math.max(0, cfg.length * scale * irrMult * t);
    return { dx: dirX * lenCss, dy: dirY * lenCss };
  },
  defaults: DEFAULTS,
};

export default Spikes;
