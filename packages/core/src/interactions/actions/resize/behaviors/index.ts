export { clampMinSize } from './clampMinSize';
export { lockAspectWithModifier } from './lockAspect';
export { snapToGrid } from './snapToGrid';

import type { BoundsConstraint } from '../../../gestures/types';
import { lockAspectWithModifier } from './lockAspect';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/** The kit's standard resize behaviors, applied when a consumer doesn't
 *  supply its own list: shift-drag locks the start pose's aspect ratio.
 *  Pass an explicit `behaviors: []` to opt out. Stateless, so one shared
 *  frozen instance is safe across every gesture. */
export const DEFAULT_RESIZE_BEHAVIORS: readonly BoundsConstraint<Bounds>[] =
  Object.freeze([lockAspectWithModifier()]);
export { snapToGuides } from './snapToGuides';
export { pointSnapToGrid } from './pointSnapToGrid';
