import type { EffectModule } from '../bases/types';
import { bumpWobble, nearestBump } from './bumps';
import { rangeMask, type BadgeRangeMaskParams } from './rangeMask';

/** What an effect of type `scallops` takes as `params`. */
export interface BadgeScallopsEffectParams extends BadgeRangeMaskParams {
  scallopRadius?: number;
  scallopSpacing?: number;
  irregularity?: number;
}

const DEFAULTS: Required<Omit<BadgeScallopsEffectParams, 'range'>> = {
  scallopRadius: 4,
  scallopSpacing: 10,
  irregularity: 0,
};

const Scallops: EffectModule<BadgeScallopsEffectParams> = {
  offsetAt: (s, { params, phase, totalCss, perimeterAt }) => {
    const cfg = { ...DEFAULTS, ...params };
    const mask = rangeMask(s, totalCss, cfg.range);
    if (mask === 0) return { dx: 0, dy: 0 };
    const sr = Math.max(0.5, cfg.scallopRadius);
    const ss = Math.max(2 * sr + 0.5, cfg.scallopSpacing);
    const N = Math.max(2, Math.floor(totalCss / ss));
    const { index, offset: ds } = nearestBump(s, totalCss, N, phase);
    const irr = Math.max(0, Math.min(cfg.irregularity, 1));
    const localR = sr * (1 + irr * 0.55 * bumpWobble(index));
    if (Math.abs(ds) > localR) return { dx: 0, dy: 0 };
    // Half-circle outward: peak at ds=0 = localR; zero at ±localR.
    const t = (ds + localR) / (2 * localR);
    const disp = localR * Math.sin(Math.PI * t) * mask;
    const pt = perimeterAt(s);
    return { dx: pt.nx * disp, dy: pt.ny * disp };
  },
  defaults: DEFAULTS,
};

export default Scallops;
