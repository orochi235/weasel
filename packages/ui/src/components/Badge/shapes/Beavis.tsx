import type { ShapeModule, ShapeComposeSpec } from '../types';
import { clampParam, repeatCount, withDefaults } from './params';

/** What `shapeParams` takes on a `beavis` badge. */
export interface BadgeBeavisShapeParams {
  points?: number;
  /** Corner radius in CSS px. */
  cornerRadius?: number;
  spikeLen?: number;
  spikeBaseWidth?: number;
  irregularity?: number;
}

const DEFAULTS: Required<BadgeBeavisShapeParams> = {
  points: 44,
  cornerRadius: 6,
  spikeLen: 12,
  spikeBaseWidth: 3,
  irregularity: 0,
};

const Beavis: ShapeModule<BadgeBeavisShapeParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = withDefaults(DEFAULTS, params);
    return {
      base: 'rounded-rect',
      baseParams: { radius: clampParam(cfg.cornerRadius, 0, Infinity, DEFAULTS.cornerRadius) },
      effects: [
        {
          type: 'spikes',
          params: {
            count: repeatCount(cfg.points, 3),
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
