import type { GestureContext } from '@weasel-js/core';
import type { Guide } from '../guides/types';

/** A gesture's `plane`: how the camera's world maps into the world its poses are in. */
type Plane = GestureContext<unknown>['plane'];
type Axis = 'x' | 'y';

/** Where a guide the camera draws lies along its own axis in the world a gesture's poses are in. */
export function guideOffsetOn(g: Guide, plane: Plane): number {
  return plane ? g.offset * plane.scale[g.axis] + plane.offset[g.axis] : g.offset;
}

/** The signed distance from `value` to the nearest guide on `axis` within `tol`, or null when none is. */
export function nearestGuideDelta(
  guides: readonly Guide[],
  axis: Axis,
  value: number,
  tol: number,
  plane: Plane,
): number | null {
  let best: number | null = null;
  for (const g of guides) {
    if (g.axis !== axis) continue;
    const d = guideOffsetOn(g, plane) - value;
    if (Math.abs(d) <= tol && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  }
  return best;
}

/** `value` on `axis` moved to the nearest line of the camera's grid, in the world a gesture's poses are in. */
export function roundToGridOn(value: number, axis: Axis, spacing: number, plane: Plane): number {
  if (!plane) return Math.round(value / spacing) * spacing;
  const camera = (value - plane.offset[axis]) / plane.scale[axis];
  return Math.round(camera / spacing) * spacing * plane.scale[axis] + plane.offset[axis];
}
