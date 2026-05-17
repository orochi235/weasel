import type { EffectModule } from '../bases/types';
import { rangeMask, type RangeMaskParams } from './rangeMask';

export interface PuffsEffectParams extends RangeMaskParams {
  bumpWidth?: number;
  puffiness?: number;
  irregularity?: number;
}

const DEFAULTS: Required<PuffsEffectParams> = {
  bumpWidth: 18,
  puffiness: 10,
  irregularity: 0,
};

const Puffs: EffectModule<PuffsEffectParams> = {
  offsetAt: (s, { params, phase, totalCss, perimeterAt }) => {
    const cfg = { ...DEFAULTS, ...params };
    const mask = rangeMask(s, totalCss, cfg.range);
    if (mask === 0) return { dx: 0, dy: 0 };
    const N = Math.max(2, Math.round(totalCss / Math.max(6, cfg.bumpWidth)));
    const step = totalCss / N;
    const phaseOffset = phase * step;
    const sm = ((s % totalCss) + totalCss) % totalCss;
    const i = Math.floor((sm - phaseOffset) / step);
    const puffStart = i * step + phaseOffset;
    let t = (sm - puffStart) / step;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    const irr = Math.max(0, Math.min(cfg.irregularity, 1));
    const localPy = Math.max(0.5, cfg.puffiness) * (1 + irr * 0.55 * Math.sin(i * 1.73 + 0.7));
    const disp = localPy * Math.sin(Math.PI * t) * mask;
    const pt = perimeterAt(s);
    return { dx: pt.nx * disp, dy: pt.ny * disp };
  },
  defaults: DEFAULTS,
};

export default Puffs;
