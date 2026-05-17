import type { EffectModule } from '../bases/types';

export interface BitesEffectParams {
  biteRadius?: number;
  biteSpacing?: number;
  irregularity?: number;
}

const DEFAULTS: Required<BitesEffectParams> = {
  biteRadius: 3,
  biteSpacing: 8,
  irregularity: 0,
};

const Bites: EffectModule<BitesEffectParams> = {
  offsetAt: (s, { params, phase, totalCss, perimeterAt }) => {
    const cfg = { ...DEFAULTS, ...params };
    const br = Math.max(0.5, cfg.biteRadius);
    const bs = Math.max(2 * br + 0.5, cfg.biteSpacing);
    const N = Math.max(2, Math.floor(totalCss / bs));
    const step = totalCss / N;
    const phaseOffset = phase * step;
    const sm = ((s % totalCss) + totalCss) % totalCss;
    const i = Math.round((sm - phaseOffset) / step);
    const sc = ((i * step + phaseOffset) % totalCss + totalCss) % totalCss;
    let ds = sm - sc;
    if (ds > totalCss / 2) ds -= totalCss;
    if (ds < -totalCss / 2) ds += totalCss;
    const irr = Math.max(0, Math.min(cfg.irregularity, 1));
    const localR = br * (1 + irr * 0.55 * Math.sin(i * 1.73 + 0.7));
    if (Math.abs(ds) > localR) return { dx: 0, dy: 0 };
    // Triangular inward dent: deepest at ds=0 (peak −localR), zero at ds=±localR.
    const t = 1 - Math.abs(ds) / localR;
    const inward = -localR * t;
    const pt = perimeterAt(s);
    return { dx: pt.nx * inward, dy: pt.ny * inward };
  },
  defaults: DEFAULTS,
};

export default Bites;
