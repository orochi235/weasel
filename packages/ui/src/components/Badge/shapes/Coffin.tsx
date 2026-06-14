import type { ShapeModule, ShapeComposeSpec } from '../types';

export interface CoffinParams {
  headX?: number;
  headHalfHeight?: number;
  shoulderX?: number;
  shoulderHalfHeight?: number;
  footX?: number;
  footHalfHeight?: number;
}

const DEFAULTS: Required<CoffinParams> = {
  headX: 6,
  headHalfHeight: 23,
  shoulderX: 33,
  shoulderHalfHeight: 36,
  footX: 100,
  footHalfHeight: 29,
};

const Coffin: ShapeModule<CoffinParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    const hX = Math.max(0, Math.min(cfg.headX, 40));
    const sX = Math.max(hX + 1, Math.min(cfg.shoulderX, 70));
    const fX = Math.max(sX + 1, Math.min(cfg.footX, 100));
    const hH = Math.max(2, Math.min(cfg.headHalfHeight, 50));
    const sDelta = Math.max(0, Math.min(cfg.shoulderHalfHeight, 50));
    const sH = Math.min(50, hH + sDelta);
    const fH = Math.max(2, Math.min(cfg.footHalfHeight, 50));
    return {
      base: 'polygon',
      baseParams: {
        vertices: [
          [hX, 50 - hH],
          [sX, 50 - sH],
          [fX, 50 - fH],
          [fX, 50 + fH],
          [sX, 50 + sH],
          [hX, 50 + hH],
        ],
      },
    };
  },
  insets: { top: 4, right: 6, bottom: 4, left: 11 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Coffin;
