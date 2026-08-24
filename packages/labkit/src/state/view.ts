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
  return { zoom: v.zoom, pan: { x: v.pan.x, y: v.pan.y } };
}
