import { viewScreenToWorld } from '@weasel-js/geom';

/** The `View` shape: `clientToWorld` is `clientToCanvas` then `viewScreenToWorld`. */
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
  const world = viewScreenToWorld(view, { x: clientX - origin.left, y: clientY - origin.top });
  return [world.x, world.y];
}
