import type { GestureContext } from '@weasel-js/core';
import type { Guide } from '../guides/types';

/** A gesture's `plane`: how the camera's world maps into the world its poses are in. */
type Plane = GestureContext<unknown>['plane'];

/** Where a guide the camera draws lies along its own axis in the world a gesture's poses are in. */
export function guideOffsetOn(g: Guide, plane: Plane): number {
  return plane ? g.offset * plane.scale[g.axis] + plane.offset[g.axis] : g.offset;
}

