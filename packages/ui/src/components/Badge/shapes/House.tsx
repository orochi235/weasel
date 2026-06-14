import type { ShapeModule, ShapeComposeSpec } from '../types';

export interface HouseParams {
  eaveY?: number;
  peakHeight?: number;
  roofOverhang?: number;
}

const DEFAULTS: Required<HouseParams> = { eaveY: 32, peakHeight: 32, roofOverhang: 0 };

const House: ShapeModule<HouseParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    const ey = Math.max(2, Math.min(cfg.eaveY, 95));
    const peakY = ey - Math.max(0, cfg.peakHeight);
    const ov = Math.max(0, Math.min(cfg.roofOverhang, 12));
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
