/** Option surface for the `rotate` action.
 *
 *  Lives in a sibling file (not `rotate.ts`) so the type contract stays stable
 *  even after the legacy `useRotate` hook is gone.
 *  Consumers should import from here directly; `rotate.ts` re-exports the
 *  same symbols for back-compat. */

import type { RotateBehavior, RotatedPose } from '../../gestures/types';
import type { DebugSink } from '../../../debug/types';

/** Options for the `rotate` action. */
export interface UseRotateOptions<TPose> {
  /** Behaviors are typed against the pose shape; the kit ships none yet
   *  (rotation snap behaviors are deferred). For non-rect TPose, behaviors
   *  are typed `never` for a pose without a numeric `rotation`. */
  behaviors?: TPose extends RotatedPose ? RotateBehavior<TPose>[] : never;
  rotateLabel?: string;
  /** Reserved; rotate is never transient in practice. Ignored. */
  transient?: boolean;
  onGestureStart?: (id: string) => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Optional debug sink. When supplied, records the rotation-handle
   *  position + circular hitbox at gesture start. Tree-shakes via
   *  optional-chain when omitted. */
  debug?: DebugSink;
  /** World-pixel distance from the AABB top edge to the rotation handle.
   *  Used for debug-recording the handle position. Default
   *  `DEFAULT_ROTATION_HANDLE_DISTANCE`. */
  rotationHandleDistance?: number;
  /** Hit-test radius for the rotation handle, in screen pixels. Used for
   *  the recorded debug hitbox circle. Default `8`. */
  handleHitRadius?: number;
  /** Multi-selection pivot mode. Default `'union'`.
   *  - `'each'`: each item rotates around its own center.
   *  - `'union'`: each item rotates around the selection's union center;
   *    item centers orbit the union center while also gaining the same
   *    rotation delta.
   *  Has no effect on single-id gestures. */
  pivot?: 'each' | 'union';
}
