import type { ShapeModule, ShapeComposeSpec } from '../types';
import type { BadgeRibbonEnd } from '../bases/Ribbon';

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
    const cfg = { ...DEFAULTS, ...params };
    return { base: 'ribbon', baseParams: cfg };
  },
  // Unused at render time when `compose` is set — the base's insets win — but
  // required by the ShapeModule contract.
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Ribbon;
