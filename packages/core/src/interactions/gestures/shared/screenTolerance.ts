import type { View } from 'core/viewport/view';
import type { PlaneMap } from 'core/viewport/parallax';
import { pxExtent } from 'core/viewport/pxExtent';
import type { GestureContext } from '../types';
import type { ViewApi } from 'interactions/actions/depSchema';

/** A screen-pixel tolerance in world units, per axis, through the camera of
 *  the view the gesture landed in. With no view, one pixel is one unit. */
export function screenTolerance(
  px: number,
  ctx: Pick<GestureContext<unknown>, 'view'>,
): { x: number; y: number } {
  const view: View | null = ctx.view;
  return view ? pxExtent(px, view.scale) : { x: px, y: px };
}

/** Reads the camera the gesture's `deps.view` answers for — the routed
 *  view's, when the surface hosts several. Capture it at `start`: the
 *  dispatcher hands `onMove` no deps. */
export function gestureViewReader(deps: { view?: unknown }): () => View | null {
  const api = deps.view as ViewApi | undefined;
  return () => api?.get() ?? null;
}

/** Reads the plane the gesture edits in, off the same `deps.view` — see
 *  `ViewApi.plane`. Null in the camera's own world. */
export function gesturePlaneReader(deps: { view?: unknown }): () => PlaneMap | null {
  const api = deps.view as ViewApi | undefined;
  return () => api?.plane?.() ?? null;
}
