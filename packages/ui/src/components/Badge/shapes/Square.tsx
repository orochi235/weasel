import type { ShapeModule, ShapeComposeSpec } from '../types';

export interface SquareParams {
  /** 0..1 fraction of the maximum corner rounding (1 = full pill). */
  erosion?: number;
}

const DEFAULTS: Required<SquareParams> = { erosion: 0.16 };

const Square: ShapeModule<SquareParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    return { base: 'rounded-rect', baseParams: { erosion: cfg.erosion } };
  },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Square;
