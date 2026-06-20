/**
 * Convert client coords directly to world coords by subtracting the canvas
 * rect origin and then applying the inverse view transform.
 *
 * This is the composition of `clientToCanvas` + the view-inverse half of
 * `screenToWorld`, but expressed against the `ViewLike` shape used by
 * `SceneCanvas` / `ToolCtx` (`{ scale: { x, y }, x, y }`) rather than the
 * `ViewTransform` shape used by `screenToWorld` (`{ panX, panY, zoom }`).
 */
export interface ViewLike {
  scale: { x: number; y: number };
  x: number;
  y: number;
}

/**
 * Map a browser client coord pair to world coords.
 *
 * @param clientX  - `event.clientX`
 * @param clientY  - `event.clientY`
 * @param rect     - bounding rect of the canvas element (at minimum `left`/`top`)
 * @param view     - current viewport transform
 */
export function clientToWorld(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  view: ViewLike,
): [number, number] {
  return [
    (clientX - rect.left) / view.scale.x + view.x,
    (clientY - rect.top) / view.scale.y + view.y,
  ];
}
