import type { View } from './view';
import type { Rect } from '@weasel-js/geom';

/** The world rect a view is not allowed to show outside of. */
export type ClampBounds = Rect;

/** Canvas dimensions in CSS pixels — needed to know how much world a view
 *  actually shows. */
export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * Clamp a `View` so the visible world rect stays within `bounds`.
 *
 * Visible world rect = `[view.x, view.x + canvas.width / view.scale.x]` ×
 * `[view.y, view.y + canvas.height / view.scale.y]`.
 *
 * If the visible rect is larger than `bounds` along an axis (zoomed out
 * past the bounds extent), the view is centered on that axis so bounds
 * sits in the middle of the canvas.
 */
export function clampView(view: View, bounds: ClampBounds, canvas: CanvasSize): View {
  const x = clampAxis(view.x, canvas.width / view.scale.x, bounds.x, bounds.width);
  const y = clampAxis(view.y, canvas.height / view.scale.y, bounds.y, bounds.height);
  return x === view.x && y === view.y ? view : { x, y, scale: view.scale };
}

/**
 * One axis of {@link clampView}. A negative `span` is a flipped axis: the
 * visible range runs the other way from `pos`, so the anchor is its far edge.
 * A span too wide for a double has no finite position, so `pos` stays.
 */
function clampAxis(pos: number, span: number, start: number, size: number): number {
  const vis = Math.abs(span);
  const flip = span < 0;
  let next: number;
  if (vis >= size) {
    const center = start + size / 2;
    next = flip ? center + vis / 2 : center - vis / 2;
  } else {
    const min = flip ? start + vis : start;
    const max = flip ? start + size : start + size - vis;
    next = pos < min ? min : pos > max ? max : pos;
  }
  return Number.isFinite(next) ? next : pos;
}
