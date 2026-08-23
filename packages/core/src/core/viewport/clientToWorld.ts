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
 * @param origin   - client-space origin of the surface `view` is a camera on.
 *   For a whole canvas that is its bounding rect. For a viewport node it is
 *   the canvas rect offset by the viewport's own rect, so the same call maps
 *   into that viewport's inner world.
 * @param view     - current viewport transform
 */
export function clientToWorld(
  clientX: number,
  clientY: number,
  origin: { left: number; top: number },
  view: ViewLike,
): [number, number] {
  return [
    (clientX - origin.left) / view.scale.x + view.x,
    (clientY - origin.top) / view.scale.y + view.y,
  ];
}
