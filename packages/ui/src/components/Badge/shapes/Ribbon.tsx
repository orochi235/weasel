import type { ShapeModule, ShapeComposeSpec, ShapeInsets } from '../types';
import { withDefaults } from './params';
import RibbonBase, { type BadgeRibbonEnd } from '../bases/Ribbon';

/** What `shapeParams` takes on a `ribbon` badge. */
export interface BadgeRibbonShapeParams {
  left?: BadgeRibbonEnd;
  right?: BadgeRibbonEnd;
  /** Taper depth in CSS px. The actual pointer width stays fixed regardless
   *  of badge width — the underlying base recomputes viewBox vertices at
   *  build time using the rendered box dimensions. */
  taperWidth?: number;
}

const DEFAULTS: Required<BadgeRibbonShapeParams> = { left: 'inward', right: 'outward', taperWidth: 8 };

const Ribbon: ShapeModule<BadgeRibbonShapeParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = withDefaults(DEFAULTS, params);
    return { base: 'ribbon', baseParams: cfg };
  },
  insets: (params) => (RibbonBase.insets as (p: BadgeRibbonShapeParams) => ShapeInsets)(withDefaults(DEFAULTS, params)),
  stretches: true,
  defaults: DEFAULTS,
};

export default Ribbon;
