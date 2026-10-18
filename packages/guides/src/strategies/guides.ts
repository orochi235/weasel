import {
  type GestureContext,
  type SnapStrategy,
  screenTolerance,
  type OriginProjection,
  AUTO_ORIGIN_PROJECTION,
} from '@weasel-js/core';
import type { Guide } from '../guides/types';
import { nearestGuideDelta } from './onPlane';

/** Default snap tolerance (screen pixels). */
export const DEFAULT_GUIDE_TOLERANCE_PX = 6;

/** A guide snap's reach in screen px: its own `tolerance`, else the gesture's
 *  `targets.guideSnapPx` kit setting, else `DEFAULT_GUIDE_TOLERANCE_PX`. */
export function guideTolerance(own: number | undefined, ctx: Pick<GestureContext<unknown>, 'kitSettings'>): number {
  return own ?? ctx.kitSettings?.get('targets.guideSnapPx') ?? DEFAULT_GUIDE_TOLERANCE_PX;
}

/** Options for `guideSnapStrategy`. */
export interface GuideSnapOptions<TPose> {
  /**
   * Tolerance in screen pixels, divided by the gesture view's scale so the
   * trigger zone stays the same on screen at every zoom. Defaults to the
   * `targets.guideSnapPx` kit setting, else `DEFAULT_GUIDE_TOLERANCE_PX`.
   */
  tolerance?: number;
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
 * Combining with `gridSnapStrategy` is left to the consumer.
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
  const proj: OriginProjection<TPose> =
    options.origin ?? (AUTO_ORIGIN_PROJECTION as unknown as OriginProjection<TPose>);

  return {
    snap(pose, ctx) {
      const guides = getGuides();
      if (guides.length === 0) return null;

      // Per axis: a guide on the x axis is matched by a horizontal distance,
      // so it answers to `scale.x` alone.
      const tol = screenTolerance(guideTolerance(options.tolerance, ctx), ctx);

      const o = proj.getOrigin(pose);
      const dx = nearestGuideDelta(guides, 'x', o.x, tol.x, ctx.plane) ?? 0;
      const dy = nearestGuideDelta(guides, 'y', o.y, tol.y, ctx.plane) ?? 0;
      if (dx === 0 && dy === 0) return null;
      return proj.translate(pose, dx, dy);
    },
  };
}
