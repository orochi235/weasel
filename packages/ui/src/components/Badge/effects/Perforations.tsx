import type { EffectModule } from '../bases/types';
import { clampParam } from '../shapes/params';
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
/** The closest holes sit, in CSS px, so a zero spacing and radius cannot mint holes without end. */
const MIN_HOLE_PITCH = 1;

const Perforations: EffectModule<BadgePerforationsEffectParams> = {
  Component: ({ sampler, boxW, boxH, params, phase }) => {
    const cfg = { ...DEFAULTS, ...params };
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const total = sampler.totalCss;
    const holeRadius = clampParam(cfg.holeRadius, 0, Infinity, DEFAULTS.holeRadius);
    const pitch = clampParam(Math.max(2 * holeRadius, cfg.holeSpacing), MIN_HOLE_PITCH, Infinity, DEFAULTS.holeSpacing);
    const N = Math.max(2, Math.floor(total / pitch));
    const step = total / N;
    const holes: { cx: number; cy: number }[] = [];
    for (let i = 0; i < N; i++) {
      const sCss = (i + 0.5 + phase) * step;
      if (rangeMask(sCss, total, params?.range) === 0) continue;
      const pt = sampler.perimeterAt(sCss);
      holes.push({ cx: pt.x, cy: pt.y });
    }
    const rx = holeRadius * sx;
    const ry = holeRadius * sy;
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
