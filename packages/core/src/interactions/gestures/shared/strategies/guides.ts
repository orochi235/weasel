import type { SnapStrategy } from '../../types';
import type { Guide } from 'features/guides/types';
import type { View } from 'core/viewport/view';
import { pxExtent } from 'core/viewport/pxExtent';
import type { OriginProjection } from './grid';
import { RECT_ORIGIN_PROJECTION } from './grid';

/** Default snap tolerance (screen pixels). */
export const DEFAULT_GUIDE_TOLERANCE_PX = 6;

/** Options for `guideSnapStrategy`. */
export interface GuideSnapOptions<TPose> {
  /**
   * Tolerance, in screen pixels (CSS px) when `getView` is provided, or in
   * world units otherwise. Defaults to `DEFAULT_GUIDE_TOLERANCE_PX`.
   */
  tolerance?: number;
  /**
   * Read the active view transform. When supplied, `tolerance` is interpreted
   * in screen pixels and divided by `view.scale` so the trigger zone stays
   * the same on screen as the user zooms in/out. Without it, `tolerance`
   * is treated as world units.
   */
  getView?: () => View;
  /**
   * Projection used when `TPose` doesn't expose `{x, y}` directly (Path,
   * polygon, etc.) — same contract as `gridSnapStrategy`. Defaults to the
   * rect-pose identity projection.
   */
  origin?: OriginProjection<TPose>;
}

/**
 * Snap-strategy that snaps the pose's origin to the nearest guide line on
 * each axis when within tolerance. Each axis is considered independently:
 * a vertical guide (`axis: 'x'`) constrains X, a horizontal guide
 * (`axis: 'y'`) constrains Y. When multiple guides are within range on the
 * same axis, the closest wins.
 *
 * Pair with `useGuides` for storage and `createGuidesLayer` for rendering.
 *
 * **Composition:** combining with `gridSnapStrategy` is left to the
 * consumer in v1 — typically by picking one based on a modifier key, or
 * by stacking two move/resize/insert behaviors in priority order.
 */
export function guideSnapStrategy<TPose extends { x: number; y: number }>(
  getGuides: () => readonly Guide[],
  options?: Omit<GuideSnapOptions<TPose>, 'origin'>,
): SnapStrategy<TPose>;
/** As above, for a `TPose` that is not a rect: `origin` tells the strategy how
 *  to read and write the pose's origin. */
export function guideSnapStrategy<TPose>(
  getGuides: () => readonly Guide[],
  options: GuideSnapOptions<TPose> & { origin: OriginProjection<TPose> },
): SnapStrategy<TPose>;
/** Snap a pose's origin to the nearest guide line within tolerance, per axis. */
export function guideSnapStrategy<TPose>(
  getGuides: () => readonly Guide[],
  options: GuideSnapOptions<TPose> = {},
): SnapStrategy<TPose> {
  const tolerance = options.tolerance ?? DEFAULT_GUIDE_TOLERANCE_PX;
  const getView = options.getView;
  const proj: OriginProjection<TPose> =
    options.origin ?? (RECT_ORIGIN_PROJECTION as unknown as OriginProjection<TPose>);

  return {
    snap(pose) {
      const guides = getGuides();
      if (guides.length === 0) return null;

      // Convert tolerance to world units, per axis: a guide on the x axis is
      // matched by a horizontal distance, so it answers to `scale.x` alone.
      // With no view, treat tolerance as already-world.
      const tol = getView ? pxExtent(tolerance, getView().scale) : { x: tolerance, y: tolerance };

      const o = proj.getOrigin(pose);

      let bestDx = 0;
      let bestAbsDx = Infinity;
      let bestDy = 0;
      let bestAbsDy = Infinity;

      for (const g of guides) {
        if (g.axis === 'x') {
          const d = g.offset - o.x;
          const ad = Math.abs(d);
          if (ad <= tol.x && ad < bestAbsDx) {
            bestAbsDx = ad;
            bestDx = d;
          }
        } else {
          const d = g.offset - o.y;
          const ad = Math.abs(d);
          if (ad <= tol.y && ad < bestAbsDy) {
            bestAbsDy = ad;
            bestDy = d;
          }
        }
      }

      if (bestAbsDx === Infinity && bestAbsDy === Infinity) return null;
      const dx = bestAbsDx === Infinity ? 0 : bestDx;
      const dy = bestAbsDy === Infinity ? 0 : bestDy;
      if (dx === 0 && dy === 0) return null;
      return proj.translate(pose, dx, dy);
    },
  };
}
