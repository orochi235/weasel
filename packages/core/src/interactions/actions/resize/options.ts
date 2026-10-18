/** Option surface for the `resize` action. */

import type { BoundsConstraint } from '../../gestures/types';
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
  /** Expand the incoming id into leaf ids, for resizing a group: the kit
   *  resizes the union AABB of the leaves' bounds and remaps each leaf into
   *  the result. Called once at `start()`. Returning `[]` aborts the gesture
   *  cleanly. */
  expandIds?: (ids: string[]) => string[];
  /** Per-node resizability predicate. Returns `false` for nodes that should
   *  never show resize handles (and thus can't start a resize gesture). The
   *  handles hide whenever any selected node is non-resizable. Default: every
   *  node resizable. */
  resizable?: (id: string) => boolean;
  /** Give the selection a resize handle at the middle of each edge, as well
   *  as each corner: it resizes along one axis with the opposite edge pinned.
   *  A side too short on screen for one (`EDGE_HANDLE_MIN_RADII` handle
   *  radii) shows none. Read by `<SceneCanvas>` for its overlay and hit-test.
   *  Default true. */
  edgeHandles?: boolean;
}
