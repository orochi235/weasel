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

/** The screen pixel `view` draws world point `p` at, from the canvas top-left. */
export function viewWorldToScreen(view: View, p: { x: number; y: number }): { x: number; y: number } {
  return { x: (p.x - view.x) * view.scale.x, y: (p.y - view.y) * view.scale.y };
}

/** The world point under screen pixel `p`; the inverse of {@link viewWorldToScreen}. */
export function viewScreenToWorld(view: View, p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x / view.scale.x + view.x, y: p.y / view.scale.y + view.y };
}

/**
 * World rect `r` in screen pixels through `view`. A flipped axis (negative
 * scale) still gives a positive width and height, with `x` / `y` at the
 * rect's top-left on screen.
 */
export function viewRectToScreen(
  view: View,
  r: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const x0 = (r.x - view.x) * view.scale.x;
  const y0 = (r.y - view.y) * view.scale.y;
  const w = r.width * view.scale.x;
  const h = r.height * view.scale.y;
  return {
    x: w < 0 ? x0 + w : x0,
    y: h < 0 ? y0 + h : y0,
    width: Math.abs(w),
    height: Math.abs(h),
  };
}
