/** Option surface for the `resize` action. */

import type {
  PointSnapBehavior,
  BoundsConstraint,
} from '../../gestures/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/** Options for the `resize` action: the constraints applied to the dragged
 *  bounding box, how a gesture expands a group into its leaves, and its
 *  history and lifecycle. `<SceneCanvas>` publishes them as the
 *  `resizePolicy` dep (`resizePolicyOptions`). */
export interface UseResizeOptions<TPose> {
  /** Behaviors are rect-typed: they read/write `{x,y,width,height}`. For a
   *  non-rect `TPose`, constraints are typed `never`; the pose descriptor
   *  comes from `<SceneCanvas poseDescriptor>`. */
  behaviors?: TPose extends Bounds ? BoundsConstraint<TPose>[] : never;
  /** History label for the committed resize. Default `'Resize'`. */
  resizeLabel?: string;
  /** Commit without an undo entry (`scene.untracked`), bypassing the
   *  consumer `applyOps` hook. Unset, a behavior's `defaultTransient` decides. */
  transient?: boolean;
  /** Fired when the resize starts, with the ids it writes. */
  onGestureStart?: (ids: string[]) => void;
  /** Fired once per `onGestureStart`: `true` when the resize wrote to the
   *  document, `false` on cancel, a behavior abort, or no change. */
  onGestureEnd?: (committed: boolean) => void;
  /** Optional: expand the incoming id into leaf ids before pose lookups.
   *  Used for group expansion: when the
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
  /** Behaviors that operate on world-space anchor points. Fire after
   *  `behaviors[]` (bounds-frame). Each behavior receives a `PointSnapContext`
   *  with world-space frame points and returns at most one `PointSnapResult`;
   *  the hook back-solves the local pose so the chosen frame's world point
   *  lands on the snap target. First non-null result wins. */
  pointSnapBehaviors?: TPose extends Bounds ? PointSnapBehavior<TPose>[] : never;
  /** Per-node resizability predicate. Returns `false` for nodes that should
   *  never show resize handles (and thus can't start a resize gesture) — e.g.
   *  fixed-footprint icons, locked layers. `<SceneCanvas>` folds this over the
   *  current selection into the `selectionResizable` rule-ctx flag, so the
   *  default `selection.resize-handles` chrome rule hides handles whenever any
   *  selected node is non-resizable (which also disables the affordance, since
   *  visible==hittable). Default: every node resizable. */
  resizable?: (id: string) => boolean;
}
