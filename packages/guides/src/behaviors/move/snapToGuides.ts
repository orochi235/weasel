import {
  type ModifierState,
  type MoveBehavior,
  type OriginProjection,
  snap,
} from '@weasel-js/core';
import type { Guide } from '../../guides/types';
import { guideSnapStrategy } from '../../strategies/guides';

type ModKey = keyof ModifierState;

/** Options for the move-flavored `snapToGuides`. */
export interface SnapToGuidesMoveArgs<TPose> {
  /** Stable getter into the live guide list (typically from `useGuides`). */
  getGuides: () => readonly Guide[];
  /** Snap tolerance in screen px, read through the gesture's view. */
  tolerance?: number;
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
/** As above, for a `TPose` that is not a rect: `origin` tells the behavior how
 *  to read and write the pose's origin. */
export function snapToGuides<TPose>(
  args: SnapToGuidesMoveArgs<TPose> & { origin: OriginProjection<TPose> },
): MoveBehavior<TPose>;
/** Snap the dragged pose's origin to the nearest guide line, per axis. */
export function snapToGuides<TPose>(
  args: SnapToGuidesMoveArgs<TPose>,
): MoveBehavior<TPose> {
  const strategy = guideSnapStrategy<TPose>(args.getGuides, {
    tolerance: args.tolerance,
    origin: args.origin as OriginProjection<TPose>,
  });
  return snap(strategy, { bypassKey: args.bypassKey });
}
