import { useMemo } from 'react';
import { createVelocityTracker, type VelocityTracker } from './createVelocityTracker';

export type { VelocityTracker };

/** Records recent pointer deltas and reports the current velocity, averaged
 *  over the last 100ms — the throw speed a momentum decay starts from. */
export function useVelocityTracker(): VelocityTracker {
  return useMemo(() => createVelocityTracker(), []);
}
