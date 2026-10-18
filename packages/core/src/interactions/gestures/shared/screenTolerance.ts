import type { View } from 'core/viewport/view';
import type { PlaneMap } from 'core/viewport/parallax';
import { pxExtent } from '@weasel-js/geom';
import type { GestureContext } from '../types';
import type { ActionDeps } from '@weasel-js/routing';
import type { KitSettingsStore } from '@weasel-js/react';

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
export function gestureViewReader(deps: Pick<ActionDeps, 'view'>): () => View | null {
  const api = deps.view;
  return () => api?.get() ?? null;
}

/** Reads the plane the gesture edits in, off the same `deps.view` — see
 *  `ViewApi.plane`. Null in the camera's own world. */
export function gesturePlaneReader(deps: Pick<ActionDeps, 'view'>): () => PlaneMap | null {
  const api = deps.view;
  return () => api?.plane?.() ?? null;
}

/** What a gesture builds its context from: the view and plane, read again on
 *  every move, and the kit settings, whose store reads each leaf when asked. */
export interface GestureReaders {
  view: () => View | null;
  plane: () => PlaneMap | null;
  kitSettings: KitSettingsStore | null;
}

export function gestureReaders(deps: Pick<ActionDeps, 'view' | 'kitSettings'>): GestureReaders {
  return { view: gestureViewReader(deps), plane: gesturePlaneReader(deps), kitSettings: deps.kitSettings ?? null };
}
