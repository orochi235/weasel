import type { GestureContext } from '@weasel-js/core';
import type { Guide } from '../guides/types';

/** A gesture's `plane`: how the camera's world maps into the world its poses are in. */
type Plane = GestureContext<unknown>['plane'];
type Axis = 'x' | 'y';

/** Where a guide the camera draws lies along its own axis in the world a gesture's poses are in. */
export function guideOffsetOn(g: Guide, plane: Plane): number {
  return plane ? g.offset * plane.scale[g.axis] + plane.offset[g.axis] : g.offset;
}

/** `value` on `axis` moved to the nearest line of the camera's grid, in the world a gesture's poses are in. */
export function roundToGridOn(value: number, axis: Axis, spacing: number, plane: Plane): number {
  if (!plane) return Math.round(value / spacing) * spacing;
  const camera = (value - plane.offset[axis]) / plane.scale[axis];
  return Math.round(camera / spacing) * spacing * plane.scale[axis] + plane.offset[axis];
}
