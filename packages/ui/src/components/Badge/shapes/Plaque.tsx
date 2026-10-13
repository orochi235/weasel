import type { BadgeCorner, ShapeModule, ShapeComposeSpec } from '../types';

/** What `shapeParams` takes on a `plaque` badge. */
export interface BadgePlaqueShapeParams {
  bevelWidth?: number;
  lightFrom?: BadgeCorner;
  rivetRadius?: number;
  rivetInset?: number;
  sheenIntensity?: number;
}

const DEFAULTS: Required<BadgePlaqueShapeParams> = {
  bevelWidth: 6,
  lightFrom: 'tl',
  rivetRadius: 2.4,
  rivetInset: 7,
  sheenIntensity: 0.22,
};

const Plaque: ShapeModule<BadgePlaqueShapeParams> = {
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
