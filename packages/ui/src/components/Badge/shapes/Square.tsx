import type { ShapeModule, ShapeComposeSpec } from '../types';

/** What `shapeParams` takes on a `square` badge. */
export interface BadgeSquareShapeParams {
  /** 0..1 fraction of the maximum corner rounding (1 = full pill). */
  erosion?: number;
}

const DEFAULTS: Required<BadgeSquareShapeParams> = { erosion: 0.16 };

const Square: ShapeModule<BadgeSquareShapeParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    return { base: 'rounded-rect', baseParams: { erosion: cfg.erosion } };
  },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Square;
