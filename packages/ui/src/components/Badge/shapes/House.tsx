import type { ShapeModule, ShapeComposeSpec } from '../types';
import { clampParam, withDefaults } from './params';

/** What `shapeParams` takes on a `house` badge. */
export interface BadgeHouseShapeParams {
  eaveY?: number;
  peakHeight?: number;
  roofOverhang?: number;
}

const DEFAULTS: Required<BadgeHouseShapeParams> = { eaveY: 32, peakHeight: 32, roofOverhang: 0 };

const House: ShapeModule<BadgeHouseShapeParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = withDefaults(DEFAULTS, params);
    const ey = clampParam(cfg.eaveY, 2, 95, DEFAULTS.eaveY);
    const peakY = ey - clampParam(cfg.peakHeight, 0, Infinity, DEFAULTS.peakHeight);
    const ov = clampParam(cfg.roofOverhang, 0, 12, DEFAULTS.roofOverhang);
    return {
      base: 'polygon',
      baseParams: {
        vertices: [
          [50, peakY],
          [100 + ov, ey],
          [100, ey],
          [100, 100],
          [0, 100],
          [0, ey],
          [-ov, ey],
        ],
      },
    };
  },
  insets: { top: 10, right: 4, bottom: 0, left: 4 },
  stretches: true,
  defaults: DEFAULTS,
};

export default House;
