import type { View } from './view';

/** The world rect a view is not allowed to show outside of. */
export interface ClampBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  // A negative scale is a flipped axis, so the visible rect runs the other way
  // from `view.x`/`view.y`: its extent is the magnitude, and the anchor is the
  // rect's far edge rather than its near one.
  const visW = Math.abs(canvas.width / view.scale.x);
  const visH = Math.abs(canvas.height / view.scale.y);
  const flipX = view.scale.x < 0;
  const flipY = view.scale.y < 0;

  let x: number;
  if (visW >= bounds.width) {
    x = bounds.x + (bounds.width - visW) / 2 + (flipX ? visW : 0);
  } else {
    const minX = flipX ? bounds.x + visW : bounds.x;
    const maxX = flipX ? bounds.x + bounds.width : bounds.x + bounds.width - visW;
    x = view.x < minX ? minX : view.x > maxX ? maxX : view.x;
  }

  let y: number;
  if (visH >= bounds.height) {
    y = bounds.y + (bounds.height - visH) / 2 + (flipY ? visH : 0);
  } else {
    const minY = flipY ? bounds.y + visH : bounds.y;
    const maxY = flipY ? bounds.y + bounds.height : bounds.y + bounds.height - visH;
    y = view.y < minY ? minY : view.y > maxY ? maxY : view.y;
  }

  return x === view.x && y === view.y ? view : { x, y, scale: view.scale };
}
