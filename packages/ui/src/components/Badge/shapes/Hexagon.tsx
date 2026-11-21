import type { ShapeModule, ShapeComposeSpec } from '../types';
import { clampParam, withDefaults } from './params';

/** What `shapeParams` takes on a `hexagon` badge. */
export interface BadgeHexagonShapeParams {
  tipHeight?: number;
  /** Truncate the top and bottom tips, leaving a horizontal flat edge.
   *  Measured as a distance from each tip vertically (0 = sharp point, tipHeight = fully flat). */
  tipTruncation?: number;
}

const DEFAULTS: Required<BadgeHexagonShapeParams> = { tipHeight: 25, tipTruncation: 0 };

function hexVerts(tip: number, truncation: number): [number, number][] {
  const t = clampParam(tip, 0, 49, DEFAULTS.tipHeight);
  const trunc = clampParam(truncation, 0, t, DEFAULTS.tipTruncation);
  if (trunc <= 0) {
    return [[50, 0], [100, t], [100, 100 - t], [50, 100], [0, 100 - t], [0, t]];
  }
  const ratio = trunc / t;
  const xL = 50 - 50 * ratio;
  const xR = 50 + 50 * ratio;
  return [
    [xL, trunc], [xR, trunc],
    [100, t], [100, 100 - t],
    [xR, 100 - trunc], [xL, 100 - trunc],
    [0, 100 - t], [0, t],
  ];
}

const Hexagon: ShapeModule<BadgeHexagonShapeParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = withDefaults(DEFAULTS, params);
    return { base: 'polygon', baseParams: { vertices: hexVerts(cfg.tipHeight, cfg.tipTruncation) } };
  },
  insets: { top: 4, right: 6, bottom: 4, left: 6 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Hexagon;
