/** Option surface for the `move` action.
 *
 *  Lives in a sibling file (not `move.ts`) so the type contract stays stable
 *  even after the legacy `useMove` hook is deleted in Phase 14e Task 4.
 *  Consumers should import from here directly; `move.ts` re-exports the
 *  same symbol for back-compat. */

import type { MoveBehavior } from '../../gestures/types';

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
  /** Optional: lookup a world-space pose by id. When supplied alongside
   *  `adapter.getChildren`, the hook walks each dragged id's descendants and
   *  includes them in the live overlay (translated by the same drag delta
   *  and added to `overlay.hideIds`) so structurally-grouped children visually
   *  follow the parent during the gesture. No transform ops are generated
   *  for cascaded ids — under local-pose semantics, a child's local pose is
   *  unchanged when its parent's local pose moves, so the post-commit scene
   *  is already correct.
   *
   *  Pair with `worldPoseLookup(adapter, composeRectPose)` from
   *  `@weasel-js/core/transforms` for the standard rect case. Returning
   *  `null` for an id (e.g., one removed mid-render) skips it. */
  cascadeWorldPose?: (id: string) => TPose | null;
}
