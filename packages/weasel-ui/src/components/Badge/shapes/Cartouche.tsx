import type { ShapeModule, ShapeComposeSpec } from '../types';

export interface CartoucheParams {
  bodyEdge?: number;
  armTipX?: number;
  pinchX?: number;
  armTipY?: number;
  samples?: number;
}

const DEFAULTS: Required<CartoucheParams> = {
  bodyEdge: 22,
  armTipX: 6,
  pinchX: 16,
  armTipY: 18,
  samples: 14,
};

const Cartouche: ShapeModule<CartoucheParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    return { base: 'cartouche', baseParams: cfg };
  },
  insets: { top: 4, right: 14, bottom: 4, left: 14 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Cartouche;
