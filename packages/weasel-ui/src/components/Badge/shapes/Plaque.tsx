import type { ShapeModule, ShapeComposeSpec } from '../types';

export type PlaqueCorner = 'tl' | 'tr' | 'bl' | 'br';

export interface PlaqueParams {
  bevelWidth?: number;
  lightFrom?: PlaqueCorner;
  rivetRadius?: number;
  rivetInset?: number;
  sheenIntensity?: number;
}

const DEFAULTS: Required<PlaqueParams> = {
  bevelWidth: 6,
  lightFrom: 'tl',
  rivetRadius: 2.4,
  rivetInset: 7,
  sheenIntensity: 0.22,
};

const Plaque: ShapeModule<PlaqueParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    return {
      base: 'rounded-rect',
      baseParams: { erosion: 0 },
      effects: [
        { type: 'bevel',  params: { bevelWidth: cfg.bevelWidth, lightFrom: cfg.lightFrom } },
        { type: 'sheen',  params: { lightFrom: cfg.lightFrom, intensity: cfg.sheenIntensity } },
        { type: 'rivets', params: { radius: cfg.rivetRadius, inset: cfg.rivetInset, lightFrom: cfg.lightFrom } },
      ],
    };
  },
  insets: { top: 6, right: 8, bottom: 6, left: 8 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Plaque;
