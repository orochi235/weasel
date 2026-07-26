import type { ModifierState, MoveBehavior } from '../../../gestures/types';
import type { Guide } from 'features/guides/types';
import type { View } from 'core/viewport/view';
import type { OriginProjection } from '../../../gestures/shared/strategies/grid';
import { snap } from '../../../gestures/shared/snap';
import { guideSnapStrategy } from '../../../gestures/shared/strategies/guides';

type ModKey = keyof ModifierState;

/** Options for the move-flavored `snapToGuides`. */
export interface SnapToGuidesMoveArgs<TPose> {
  /** Stable getter into the live guide list (typically from `useGuides`). */
  getGuides: () => readonly Guide[];
  /** Snap tolerance (screen px when `getView` is set, world units otherwise). */
  tolerance?: number;
  /** Read the active view; required for screen-pixel tolerance. */
  getView?: () => View;
  /** Modifier key that bypasses snapping while held. */
  bypassKey?: ModKey;
  /** Origin projection for non-rect TPose (e.g. Path). */
  origin?: OriginProjection<TPose>;
}

/**
 * Move behavior that snaps the dragged pose's origin to the nearest world-space
 * guide line within `tolerance`. Closest-guide-per-axis wins; the two axes are
 * considered independently. Pair with `useGuides` and `createGuidesLayer`.
 */
export function snapToGuides<TPose extends { x: number; y: number }>(
  args: Omit<SnapToGuidesMoveArgs<TPose>, 'origin'>,
): MoveBehavior<TPose>;
export function snapToGuides<TPose>(
  args: SnapToGuidesMoveArgs<TPose> & { origin: OriginProjection<TPose> },
): MoveBehavior<TPose>;
export function snapToGuides<TPose>(
  args: SnapToGuidesMoveArgs<TPose>,
): MoveBehavior<TPose> {
  const strategy = guideSnapStrategy<TPose>(args.getGuides, {
    tolerance: args.tolerance,
    getView: args.getView,
    origin: args.origin as OriginProjection<TPose>,
  });
  return snap(strategy, { bypassKey: args.bypassKey });
}
