import type { View } from '@weasel-js/geom';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { fromPlane, type PlaneMap } from 'core/viewport/parallax';

/** A point in the gesture's plane to screen px. */
export function screenOf(view: View | null, plane: PlaneMap | null): (w: readonly number[]) => readonly number[] {
  const t = view ? viewToTransform(view) : null;
  return ([x, y]) => {
    const w = plane ? fromPlane(plane, { x, y }) : { x, y };
    return t ? worldToScreen(w.x, w.y, t) : [w.x, w.y];
  };
}

/** Screen px per unit of the gesture's plane, on each axis. */
export function pxPerUnit(view: View | null, plane: PlaneMap | null): { x: number; y: number } {
  const cam = view?.scale ?? { x: 1, y: 1 };
  // A camera unit is `plane.scale` plane units.
  return plane
    ? { x: Math.abs(cam.x / plane.scale.x), y: Math.abs(cam.y / plane.scale.y) }
    : { x: Math.abs(cam.x), y: Math.abs(cam.y) };
}
