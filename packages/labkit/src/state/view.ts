import { normalizeZoom } from '@weasel-js/core';
import type { ViewTransform } from '../instrument/types';

/** The 2D view labkit has always shipped, and what a trial gets when it names no
 *  other. Re-exported under its own name so a consumer can say which it means. */
export type ViewTransform2D = ViewTransform;

export const DEFAULT_VIEW: ViewTransform2D = { zoom: 1, pan: { x: 0, y: 0 } };

/** A trial's view is opaque to labkit, so anything that needs the 2D shape — the
 *  zoom chrome, `CanvasStack` — asks for it and handles not getting it. */
export function as2DView(view: unknown): ViewTransform2D | null {
  if (typeof view !== 'object' || view === null) return null;
  const v = view as Partial<ViewTransform2D>;
  if (typeof v.zoom !== 'number') return null;
  if (typeof v.pan !== 'object' || v.pan === null) return null;
  if (typeof v.pan.x !== 'number' || typeof v.pan.y !== 'number') return null;
  return normalize2DView({ zoom: v.zoom, pan: { x: v.pan.x, y: v.pan.y } });
}

/** `view` inside the invariant every view holds: a zoom that is not a finite
 *  number of at least `ZOOM_FLOOR` becomes the floor, and a non-finite pan
 *  becomes 0. Returns `view` itself when it already holds. */
export function normalize2DView(view: ViewTransform2D): ViewTransform2D {
  const zoom = normalizeZoom(view.zoom);
  const x = Number.isFinite(view.pan.x) ? view.pan.x : 0;
  const y = Number.isFinite(view.pan.y) ? view.pan.y : 0;
  if (zoom === view.zoom && x === view.pan.x && y === view.pan.y) return view;
  return { zoom, pan: { x, y } };
}

/** `view` at a new zoom, through the same rule. */
export function withZoom(view: ViewTransform2D, zoom: number): ViewTransform2D {
  return normalize2DView({ zoom, pan: view.pan });
}
