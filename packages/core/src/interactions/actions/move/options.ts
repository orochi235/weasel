/** Option surface for the `move` action.
 *
 *  Lives in a sibling file (not `move.ts`) so the type contract stays stable
 *  even after the legacy `useMove` hook is gone.
 *  Consumers should import from here directly; `move.ts` re-exports the
 *  same symbol for back-compat. */

import type { MoveBehavior } from '../../gestures/types';

/** Options for the `move` action: how a translation is applied to the pose,
 *  and the behaviors (snapping, momentum) layered over the raw drag. */
export interface UseMoveOptions<TPose> {
  /** How to apply a `(dx, dy)` translation to a pose. Defaults to
   *  `translateRectPose`, which assumes the pose carries top-level
   *  `x`/`y` (the common rect-shaped case). Override for non-rect poses
   *  (e.g. `Path` → `translatePath`). */
  translatePose?: (pose: TPose, dx: number, dy: number) => TPose;
  behaviors?: MoveBehavior<TPose>[];
  dragThresholdPx?: number;
  moveLabel?: string;
  /** Reserved for transient gestures (no history entry). Move is never transient
   *  in practice; accepted for API consistency but ignored. */
  transient?: boolean;
  onGestureStart?(ids: string[]): void;
  onGestureEnd?(committed: boolean): void;
  /** Optional: expand the incoming id list before pose lookups. Used for
   *  group expansion (groups have no pose; their leaves do).
   *  Called once at `start()`. The returned list flows through ctx,
   *  overlay (`overlay.draggedIds` is the **expanded** leaves), and op
   *  generation. Returning `[]` aborts the gesture cleanly.
   *  Default: identity. */
  expandIds?: (ids: string[]) => string[];
}
