import { polygonSampler } from './polygonSampler';
import type { BaseModule } from './types';

/** What `baseParams` takes on a badge whose `base` is `chamfered-rect`. */
export interface BadgeChamferedRectBaseParams {
  /** CSS px length of each 45° corner chamfer, held to half the badge's shorter side. */
  chamfer?: number;
}

const DEFAULTS: Required<BadgeChamferedRectBaseParams> = { chamfer: 6 };

const ChamferedRect: BaseModule<BadgeChamferedRectBaseParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const chamfer = Math.max(0, Math.min(cfg.chamfer, boxW / 2, boxH / 2));
    const cx = chamfer * sx;
    const cy = chamfer * sy;
    // 8 vertices traced clockwise from top-left chamfer start.
    const verts: [number, number][] = [
      [cx, 0],
      [100 - cx, 0],
      [100, cy],
      [100, 100 - cy],
      [100 - cx, 100],
      [cx, 100],
      [0, 100 - cy],
      [0, cy],
    ];
    return polygonSampler(verts, boxW, boxH);
  },
  defaults: DEFAULTS,
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
};

export default ChamferedRect;
