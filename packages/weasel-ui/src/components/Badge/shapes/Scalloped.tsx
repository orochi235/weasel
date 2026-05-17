import type { ShapeModule, ShapeComposeSpec } from '../types';

export interface ScallopedParams {
  scallopRadius?: number;
  scallopSpacing?: number;
  irregularity?: number;
}

const DEFAULTS: Required<ScallopedParams> = { scallopRadius: 5, scallopSpacing: 12, irregularity: 0 };

const Scalloped: ShapeModule<ScallopedParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    return {
      base: 'rounded-rect',
      baseParams: { erosion: 0 },
      effects: [
        {
          type: 'scallops',
          params: { scallopRadius: cfg.scallopRadius, scallopSpacing: cfg.scallopSpacing, irregularity: cfg.irregularity },
        },
      ],
    };
  },
  insets: { top: 4, right: 6, bottom: 4, left: 6 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Scalloped;
