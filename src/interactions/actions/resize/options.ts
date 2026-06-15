/** Option surface for the `resize` action.
 *
 *  Lives in a sibling file (not `resize.ts`) so the type contract stays stable
 *  even after the legacy `useResize` hook is gone.
 *  Consumers should import from here directly; `resize.ts` re-exports the
 *  same symbol for back-compat. */

import type {
  PointSnapBehavior,
  BoundsConstraint,
  ResizePose,
} from '../../gestures/types';
import type { PoseProjection } from './geometry';
import type { DebugSink } from '../../../debug/types';

export interface UseResizeOptions<TPose> {
  /** Behaviors are rect-typed: they read/write `{x,y,width,height}`. When
   *  `TPose` is non-rect, pass `geometry` to project pose↔bounds; behaviors
   *  in that case are typed `never` because none in the kit's library would
   *  understand the pose shape. */
  behaviors?: TPose extends ResizePose ? BoundsConstraint<TPose>[] : never;
  resizeLabel?: string;
  /** Reserved; resize is never transient in practice. Ignored. */
  transient?: boolean;
  onGestureStart?: (id: string) => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Optional: expand the incoming id into leaf ids before pose lookups.
   *  Mirrors `useMove`'s `expandIds`. Used for group expansion: when the
   *  gesture is started against a group id, the kit
   *  resizes by computing the union AABB of the leaves' origin bounds,
   *  running the compute pipeline on that union rect (group bounds), and
   *  remapping each leaf via `geometry.remapBounds(leaf, originGroupBounds,
   *  proposedGroupBounds)`.
   *
   *  When `expandIds` is omitted or returns the original single id, the
   *  gesture takes the single-leaf path (the leaf's own bounds become both
   *  the origin and the target of the same `remapBounds` call).
   *
   *  Called once at `start()`. Returning `[]` aborts the gesture cleanly. */
  expandIds?: (ids: string[]) => string[];
  /** Projection from `TPose` to bounds and back. Defaults to rect identity
   *  when `TPose extends ResizePose`. Required for non-rect TPose (Path,
   *  polygon, etc.). */
  geometry?: PoseProjection<TPose>;
  /** Behaviors that operate on world-space anchor points. Fire after
   *  `behaviors[]` (bounds-frame). Each behavior receives a `PointSnapContext`
   *  with world-space frame points and returns at most one `PointSnapResult`;
   *  the hook back-solves the local pose so the chosen frame's world point
   *  lands on the snap target. First non-null result wins. */
  pointSnapBehaviors?: TPose extends ResizePose ? PointSnapBehavior<TPose>[] : never;
  /** Optional debug sink. When supplied, records corner-handle positions +
   *  circular hitboxes when the gesture starts (covers the on-screen
   *  handles for the resized target). Tree-shakes via optional-chain
   *  when omitted. */
  debug?: DebugSink;
  /** Hit-test radius for corner handles, in screen pixels. Used purely for
   *  the recorded debug hitbox circle radius — does not affect actual hit
   *  math (which lives in `usePointerGestures`). Default `8`. */
  handleHitRadius?: number;
}
