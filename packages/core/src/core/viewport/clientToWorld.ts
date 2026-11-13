import { viewScreenToWorld, type View } from '@weasel-js/geom';

/**
 * Map a browser client coord pair to world coords.
 *
 * @param clientX  - `event.clientX`
 * @param clientY  - `event.clientY`
 * @param origin   - client-space origin of the surface `view` is a camera on.
 *   For a whole canvas that is its bounding rect. For a viewport node it is
 *   the canvas rect offset by the viewport's own rect, so the same call maps
 *   into that viewport's inner world. Give it a `scale` — `layoutBoxOf(canvas)`
 *   carries one — and a surface an ancestor transform shows larger or smaller
 *   than its CSS size maps right too.
 * @param view     - current viewport transform
 */
export function clientToWorld(
  clientX: number,
  clientY: number,
  origin: { left: number; top: number; scale?: { x: number; y: number } },
  view: View,
): [number, number] {
  const sx = origin.scale?.x ?? 1;
  const sy = origin.scale?.y ?? 1;
  const world = viewScreenToWorld(view, { x: (clientX - origin.left) / sx, y: (clientY - origin.top) / sy });
  return [world.x, world.y];
}
