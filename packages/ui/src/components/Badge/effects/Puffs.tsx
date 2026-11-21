import type { EffectModule } from '../bases/types';
import { clampParam, finiteOr } from '../shapes/params';
import { bumpWobble, nearestBump } from './bumps';
import { rangeMask, type BadgeRangeMaskParams } from './rangeMask';

/** What an effect of type `puffs` takes as `params`. */
export interface BadgePuffsEffectParams extends BadgeRangeMaskParams {
  bumpWidth?: number;
  puffiness?: number;
  irregularity?: number;
}

const DEFAULTS: Required<Omit<BadgePuffsEffectParams, 'range'>> = {
  bumpWidth: 18,
  puffiness: 10,
  irregularity: 0,
};

const Puffs: EffectModule<BadgePuffsEffectParams> = {
  offsetAt: (s, { params, phase, totalCss, perimeterAt }) => {
    const cfg = { ...DEFAULTS, ...params };
    const mask = rangeMask(s, totalCss, cfg.range);
    if (mask === 0) return { dx: 0, dy: 0 };
    const N = Math.max(2, Math.round(totalCss / Math.max(6, finiteOr(cfg.bumpWidth, DEFAULTS.bumpWidth))));
    const { index, offset } = nearestBump(s, totalCss, N, phase + 0.5);
    const t = offset / (totalCss / N) + 0.5;
    const irr = clampParam(cfg.irregularity, 0, 1, DEFAULTS.irregularity);
    const localPy = Math.max(0.5, finiteOr(cfg.puffiness, DEFAULTS.puffiness)) * (1 + irr * 0.55 * bumpWobble(index));
    const disp = localPy * Math.sin(Math.PI * t) * mask;
    const pt = perimeterAt(s);
    return { dx: pt.nx * disp, dy: pt.ny * disp };
  },
  defaults: DEFAULTS,
};

export default Puffs;
