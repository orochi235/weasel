import { polygonSampler } from './polygonSampler';
import type { BaseModule } from './types';

export interface ChamferedRectParams {
  /** CSS px length of each 45° corner chamfer. */
  chamfer?: number;
}

const DEFAULTS: Required<ChamferedRectParams> = { chamfer: 6 };

const ChamferedRect: BaseModule<ChamferedRectParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    // Chamfer per axis (CSS px → viewBox per-axis).
    const cx = cfg.chamfer * sx;
    const cy = cfg.chamfer * sy;
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
