import type { ShapeModule, ShapeComposeSpec } from '../types';

export interface CloudParams {
  bumpWidth?: number;
  puffiness?: number;
  /** 0..1 fraction of max body roundness. */
  erosion?: number;
  irregularity?: number;
}

const DEFAULTS: Required<CloudParams> = {
  bumpWidth: 24,
  puffiness: 14,
  erosion: 0.2,
  irregularity: 0,
};

const Cloud: ShapeModule<CloudParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    return {
      base: 'rounded-rect',
      baseParams: { erosion: cfg.erosion },
      effects: [
        {
          type: 'puffs',
          params: { bumpWidth: cfg.bumpWidth, puffiness: cfg.puffiness, irregularity: cfg.irregularity },
        },
      ],
    };
  },
  insets: { top: 6, right: 8, bottom: 6, left: 8 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Cloud;
