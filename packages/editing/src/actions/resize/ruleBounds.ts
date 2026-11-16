import { isRectPose } from '@weasel-js/core/engine';
import type { Bounds } from '@weasel-js/core';
import type { PoseDescriptor } from '@weasel-js/core/engine';

/** `pose` as the bounds a constraint or a point snap reads. A pose that is
 *  already a box goes through whole, so a `rotation` on it rides along. */
export function boundsForRules(geometry: PoseDescriptor<unknown>, pose: unknown): Bounds {
  return isRectPose(pose) ? pose : geometry.getBounds(pose);
}
