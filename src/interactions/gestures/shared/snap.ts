import type { MoveBehavior, ModifierState, SnapStrategy } from '../types';
import {
  RECT_ORIGIN_PROJECTION,
  type OriginProjection,
} from './strategies/grid';

type ModKey = keyof ModifierState;

/**
 * Generic snap behavior factory: wraps a `SnapStrategy` and returns a
 * `MoveBehavior` whose `onMove` returns a uniform `GroupTransform`.
 *
 * Implementation:
 *   1. Compute the primary's proposed pose by applying the gesture's
 *      `transform` (translate) to `origin.get(primaryId)`.
 *   2. Call `strategy.snap(proposed)`. If null, no-op.
 *   3. Derive the snapped delta via the `OriginProjection`:
 *        dx = origin(snapped).x - origin(originPose).x
 *      ...so the gesture applies the same delta to every dragged id.
 *
 * The pose-shape-aware delta extraction lives here — gestures stay pose-shape
 * agnostic. Default projection is `{x, y}`-bearing (rect / path / polygon).
 * Pass `origin` for exotic poses.
 */
export function snap<TPose>(
  strategy: SnapStrategy<TPose>,
  opts: { bypassKey?: ModKey; origin?: OriginProjection<TPose> } = {},
): MoveBehavior<TPose> {
  const { bypassKey } = opts;
  const proj: OriginProjection<TPose> = opts.origin
    ?? (RECT_ORIGIN_PROJECTION as unknown as OriginProjection<TPose>);
  return {
    onMove(ctx, transform) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      // The new contract: behaviors see a GroupTransform, not a pose. But
      // strategies still operate on poses. Reconstruct the proposed pose
      // by applying the (translate) transform to the primary's origin.
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
