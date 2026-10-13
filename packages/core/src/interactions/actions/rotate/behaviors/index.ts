export { DEFAULT_ROTATION_SNAP_STEP, snapRotationWithModifier } from './snapRotation';

import type { RotateBehavior } from '../../../gestures/types';
import { snapRotationWithModifier } from './snapRotation';

/** The kit's standard rotate behaviors, applied when a rotate binding names
 *  none: shift-drag snaps the angle to 15 degree steps. An explicit
 *  `behaviors: []` opts out. Stateless, so one shared frozen instance is safe
 *  across every gesture. */
export const DEFAULT_ROTATE_BEHAVIORS: readonly RotateBehavior<unknown>[] =
  Object.freeze([snapRotationWithModifier<unknown>()]);
