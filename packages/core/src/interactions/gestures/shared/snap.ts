import type { MoveBehavior, ModifierState, SnapStrategy } from '../types';
import {
  AUTO_ORIGIN_PROJECTION,
  type OriginProjection,
} from './originProjection';

type ModKey = keyof ModifierState;

/**
 * Wraps a `SnapStrategy` as a `MoveBehavior`. The strategy snaps the first
 * dragged node's proposed pose, and the delta that produces is applied to
 * every dragged id.
 *
 * The default projection reads a rect's `{x, y}` or a Path's bounds origin.
 * Pass `origin` for exotic poses.
 */
export function snap<TPose>(
  strategy: SnapStrategy<TPose>,
  opts: { bypassKey?: ModKey; origin?: OriginProjection<TPose> } = {},
): MoveBehavior<TPose> {
  const { bypassKey } = opts;
  const proj: OriginProjection<TPose> = opts.origin
    ?? (AUTO_ORIGIN_PROJECTION as unknown as OriginProjection<TPose>);
  return {
    onMove(ctx, transform) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      // Behaviors see a GroupTransform, but strategies operate on poses.
      if (transform.kind !== 'translate') return;
      const primaryId = ctx.draggedIds[0];
      if (primaryId === undefined) return;
      const originPose = ctx.origin.get(primaryId);
      if (originPose === undefined) return;
      const proposed = proj.translate(originPose, transform.dx, transform.dy);
      const snapped = strategy.snap(proposed, ctx);
      if (snapped === null) return;
      const o0 = proj.getOrigin(originPose);
      const o1 = proj.getOrigin(snapped);
      return {
        transform: { kind: 'translate', dx: o1.x - o0.x, dy: o1.y - o0.y },
      };
    },
  };
}
