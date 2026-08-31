import type { Point, ViewTransform } from '../instrument/types';
import { DEFAULT_FRAME, type WorldFrame } from './worldSpec';

/** Project a world point into screen coordinates under a view.
 *
 *  `frame` is the instrument's declared coordinate system, resolved against the
 *  viewport; omitting it gives labkit's original one — origin at the top-left,
 *  y downward. */
export function worldToScreen(
  world: Point,
  view: ViewTransform,
  frame: WorldFrame = DEFAULT_FRAME,
): Point {
  return {
    x: frame.originPx.x + view.pan.x + world.x * view.zoom,
    y: frame.originPx.y + view.pan.y + world.y * view.zoom * frame.yDir,
  };
}

/** Unproject a screen point back to world coordinates under a view. */
export function screenToWorld(
  screen: Point,
  view: ViewTransform,
  frame: WorldFrame = DEFAULT_FRAME,
): Point {
  return {
    x: (screen.x - frame.originPx.x - view.pan.x) / view.zoom,
    y: (screen.y - frame.originPx.y - view.pan.y) / (view.zoom * frame.yDir),
  };
}
