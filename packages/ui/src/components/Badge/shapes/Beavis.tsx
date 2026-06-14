import type { ShapeModule, ShapeComposeSpec } from '../types';

export interface BeavisParams {
  points?: number;
  cornerRadius?: number;
  spikeLen?: number;
  spikeBaseWidth?: number;
  irregularity?: number;
}

const DEFAULTS: Required<BeavisParams> = {
  points: 44,
  cornerRadius: 6,
  spikeLen: 12,
  spikeBaseWidth: 3,
  irregularity: 0,
};

const Beavis: ShapeModule<BeavisParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    // Nominal badge half-height for cornerRadius → erosion: real badges are ~22px tall
    // so half = 11. Clamp into [0,1].
    const erosion = Math.max(0, Math.min(1, cfg.cornerRadius / 11));
    return {
      base: 'rounded-rect',
      baseParams: { erosion },
      effects: [
        {
          type: 'spikes',
          params: {
            count: cfg.points,
            length: cfg.spikeLen,
            baseWidth: cfg.spikeBaseWidth,
            vertScale: 1,
            horzScale: 1,
            diagonalScale: 1,
            irregularity: cfg.irregularity,
          },
        },
      ],
    };
  },
  insets: { top: 6, right: 8, bottom: 6, left: 8 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Beavis;
