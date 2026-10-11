/**
 * Viewport state. `(view.x, view.y)` is the world point currently rendered at
 * the canvas top-left; `view.scale.x` / `view.scale.y` is pixels per world
 * unit on each axis.
 *
 * A `View` names no orientation, so a kernel with a camera cannot express its
 * viewport as one.
 */
export interface View {
  x: number;
  y: number;
  scale: { x: number; y: number };
}

/**
 * The smallest zoom magnitude a view can hold, in `View.scale` units.
 *
 * A view's zoom is always finite and at least this far from 0. Nothing can be
 * drawn or picked through a zoom of 0, and every screen↔world conversion
 * divides by it, so it is ruled out where views are made rather than handled
 * by each conversion.
 */
export const ZOOM_FLOOR = 1e-9;

/**
 * The one rule for a zoom magnitude: a finite number no smaller than
 * {@link ZOOM_FLOOR}. Anything else (0, negative, NaN, ±Infinity) becomes the
 * floor.
 */
export function normalizeZoom(zoom: number): number {
  return zoom >= ZOOM_FLOOR && zoom < Infinity ? zoom : ZOOM_FLOOR;
}
