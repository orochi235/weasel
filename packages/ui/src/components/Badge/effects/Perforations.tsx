import type { EffectModule } from '../bases/types';
import { rangeMask, type BadgeRangeMaskParams } from './rangeMask';

/** What an effect of type `perforations` takes as `params`. */
export interface BadgePerforationsEffectParams extends BadgeRangeMaskParams {
  /** Hole radius in CSS px. */
  holeRadius?: number;
  /** Spacing between hole centers along the perimeter, in CSS px. */
  holeSpacing?: number;
}

const DEFAULTS: Required<Omit<BadgePerforationsEffectParams, 'range'>> = {
  holeRadius: 3,
  holeSpacing: 11,
};

const Perforations: EffectModule<BadgePerforationsEffectParams> = {
  Component: ({ sampler, boxW, boxH, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const total = sampler.totalCss;
    const N = Math.max(2, Math.round(total / Math.max(2 * cfg.holeRadius, cfg.holeSpacing)));
    const step = total / N;
    const holes: { cx: number; cy: number }[] = [];
    for (let i = 0; i < N; i++) {
      const sCss = (i + 0.5) * step;
      if (rangeMask(sCss, total, params?.range) === 0) continue;
      const pt = sampler.perimeterAt(sCss);
      holes.push({ cx: pt.x, cy: pt.y });
    }
    const rx = cfg.holeRadius * sx;
    const ry = cfg.holeRadius * sy;
    return (
      <>
        {holes.map((h, i) => (
          <ellipse key={i} cx={h.cx} cy={h.cy} rx={rx} ry={ry} fill="black" />
        ))}
      </>
    );
  },
  zone: 'mask',
  defaults: DEFAULTS as BadgePerforationsEffectParams,
};

export default Perforations;
