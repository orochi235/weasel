import type { EffectModule } from '../bases/types';
import { bumpWobble, nearestBump } from './bumps';
import { rangeMask, type BadgeRangeMaskParams } from './rangeMask';

/** What an effect of type `bites` takes as `params`. */
export interface BadgeBitesEffectParams extends BadgeRangeMaskParams {
  biteRadius?: number;
  biteSpacing?: number;
  irregularity?: number;
}

const DEFAULTS: Required<Omit<BadgeBitesEffectParams, 'range'>> = {
  biteRadius: 3,
  biteSpacing: 8,
  irregularity: 0,
};

const Bites: EffectModule<BadgeBitesEffectParams> = {
  offsetAt: (s, { params, phase, totalCss, perimeterAt }) => {
    const cfg = { ...DEFAULTS, ...params };
    const mask = rangeMask(s, totalCss, cfg.range);
    if (mask === 0) return { dx: 0, dy: 0 };
    const br = Math.max(0.5, cfg.biteRadius);
    const bs = Math.max(2 * br + 0.5, cfg.biteSpacing);
    const N = Math.max(2, Math.floor(totalCss / bs));
    const { index, offset: ds } = nearestBump(s, totalCss, N, phase);
    const irr = Math.max(0, Math.min(cfg.irregularity, 1));
    const localR = br * (1 + irr * 0.55 * bumpWobble(index));
    if (Math.abs(ds) > localR) return { dx: 0, dy: 0 };
    // Triangular inward dent: deepest at ds=0 (peak −localR), zero at ds=±localR.
    const t = 1 - Math.abs(ds) / localR;
    const inward = -localR * t;
    const pt = perimeterAt(s);
    return { dx: pt.nx * inward * mask, dy: pt.ny * inward * mask };
  },
  defaults: DEFAULTS,
};

export default Bites;
