import type { EffectModule } from '../bases/types';

export interface ScallopsEffectParams {
  scallopRadius?: number;
  scallopSpacing?: number;
  irregularity?: number;
}

const DEFAULTS: Required<ScallopsEffectParams> = {
  scallopRadius: 4,
  scallopSpacing: 10,
  irregularity: 0,
};

const Scallops: EffectModule<ScallopsEffectParams> = {
  offsetAt: (s, { params, phase, totalCss, perimeterAt }) => {
    const cfg = { ...DEFAULTS, ...params };
    const sr = Math.max(0.5, cfg.scallopRadius);
    const ss = Math.max(2 * sr + 0.5, cfg.scallopSpacing);
    const N = Math.max(2, Math.floor(totalCss / ss));
    const step = totalCss / N;
    const phaseOffset = phase * step;
    const sm = ((s % totalCss) + totalCss) % totalCss;
    const i = Math.round((sm - phaseOffset) / step);
    const sc = ((i * step + phaseOffset) % totalCss + totalCss) % totalCss;
    let ds = sm - sc;
    if (ds > totalCss / 2) ds -= totalCss;
    if (ds < -totalCss / 2) ds += totalCss;
    const irr = Math.max(0, Math.min(cfg.irregularity, 1));
    const localR = sr * (1 + irr * 0.55 * Math.sin(i * 1.73 + 0.7));
    if (Math.abs(ds) > localR) return { dx: 0, dy: 0 };
    // Half-circle outward: peak at ds=0 = localR; zero at ±localR.
    const t = (ds + localR) / (2 * localR);
    const disp = localR * Math.sin(Math.PI * t);
    const pt = perimeterAt(s);
    return { dx: pt.nx * disp, dy: pt.ny * disp };
  },
  defaults: DEFAULTS,
};

export default Scallops;
