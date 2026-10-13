import type { ShapeModule, ShapeComposeSpec } from '../types';

/** What `shapeParams` takes on a `postage` badge. */
export interface BadgePostageShapeParams {
  biteRadius?: number;
  biteSpacing?: number;
  irregularity?: number;
}

const DEFAULTS: Required<BadgePostageShapeParams> = { biteRadius: 3, biteSpacing: 8, irregularity: 0 };

const Postage: ShapeModule<BadgePostageShapeParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    return {
      base: 'rounded-rect',
      baseParams: { erosion: 0 },
      effects: [
        {
          type: 'bites',
          params: { biteRadius: cfg.biteRadius, biteSpacing: cfg.biteSpacing, irregularity: cfg.irregularity },
        },
      ],
    };
  },
  insets: { top: 4, right: 6, bottom: 4, left: 6 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Postage;
