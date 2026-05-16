/** Pan offset (in pixels) plus per-axis zoom (pixels per content unit). */
export interface ViewTransform {
  panX: number;
  panY: number;
  zoom: { x: number; y: number };
}

/** Project a world-space point to screen-space pixels through a `ViewTransform`. */
export function worldToScreen(
  worldX: number,
  worldY: number,
  view: ViewTransform,
): [number, number] {
  return [view.panX + worldX * view.zoom.x, view.panY + worldY * view.zoom.y];
}

/** Inverse of `worldToScreen` — recover the world-space point under a screen-space pixel. */
export function screenToWorld(
  screenX: number,
  screenY: number,
  view: ViewTransform,
): [number, number] {
  return [(screenX - view.panX) / view.zoom.x, (screenY - view.panY) / view.zoom.y];
}
