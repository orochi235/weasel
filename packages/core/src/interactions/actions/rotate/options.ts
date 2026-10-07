/** Option surface for the `rotate` action. */

import type { RotateBehavior, RotatedPose } from '../../gestures/types';

/** Options for the `rotate` action. `selectionRotateBindings` threads
 *  them into the rotation handle's binding. */
export interface UseRotateOptions<TPose> {
  /** Behaviors are typed against the pose shape; typed `never` for a pose
   *  without a numeric `rotation`. `onMove` sees the first rotated node's
   *  turned pose, and a pose it returns sets the rotation for the whole
   *  selection. */
  behaviors?: TPose extends RotatedPose ? RotateBehavior<TPose>[] : never;
  /** History label for the committed rotation. Default `'Rotate'`. */
  rotateLabel?: string;
  /** Commit without an undo entry (`scene.untracked`), bypassing the
   *  consumer `applyOps` hook. Unset, a behavior's `defaultTransient` decides. */
  transient?: boolean;
  /** Fired when the rotation starts, with the ids it turns. */
  onGestureStart?: (ids: string[]) => void;
  /** Fired once per `onGestureStart`: `true` when the rotation wrote to the
   *  document, `false` on cancel, a behavior abort, or no net turn. */
  onGestureEnd?: (committed: boolean) => void;
  /** Multi-selection pivot mode. Default `'union'`.
   *  - `'each'`: each item rotates around its own center.
   *  - `'union'`: each item rotates around the selection's union center;
   *    item centers orbit the union center while also gaining the same
   *    rotation delta.
   *  Has no effect on single-id gestures. */
  pivot?: 'each' | 'union';
}
