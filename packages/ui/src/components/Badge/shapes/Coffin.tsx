import type { ShapeModule, ShapeComposeSpec } from '../types';
import { clampParam, withDefaults } from './params';

/** What `shapeParams` takes on a `coffin` badge. */
export interface BadgeCoffinShapeParams {
  headX?: number;
  headHalfHeight?: number;
  shoulderX?: number;
  shoulderHalfHeight?: number;
  footX?: number;
  footHalfHeight?: number;
}

const DEFAULTS: Required<BadgeCoffinShapeParams> = {
  headX: 6,
  headHalfHeight: 23,
  shoulderX: 33,
  shoulderHalfHeight: 50,
  footX: 100,
  footHalfHeight: 29,
};

const Coffin: ShapeModule<BadgeCoffinShapeParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = withDefaults(DEFAULTS, params);
    const hX = clampParam(cfg.headX, 0, 40, DEFAULTS.headX);
    const sX = clampParam(cfg.shoulderX, hX + 1, 70, DEFAULTS.shoulderX);
    const fX = clampParam(cfg.footX, sX + 1, 100, DEFAULTS.footX);
    const hH = clampParam(cfg.headHalfHeight, 2, 50, DEFAULTS.headHalfHeight);
    const sH = clampParam(cfg.shoulderHalfHeight, 2, 50, DEFAULTS.shoulderHalfHeight);
    const fH = clampParam(cfg.footHalfHeight, 2, 50, DEFAULTS.footHalfHeight);
    return {
      base: 'polygon',
      baseParams: {
        vertices: [
          [hX, 50 - hH],
          [sX, 50 - sH],
          [fX, 50 - fH],
          [fX, 50 + fH],
          [sX, 50 + sH],
          [hX, 50 + hH],
        ],
      },
    };
  },
  insets: { top: 4, right: 6, bottom: 4, left: 11 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Coffin;
