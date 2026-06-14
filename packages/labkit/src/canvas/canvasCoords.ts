import type { Point, ViewTransform } from '../instrument/types';

export function worldToScreen(world: Point, view: ViewTransform): Point {
  return {
    x: world.x * view.zoom + view.pan.x,
    y: world.y * view.zoom + view.pan.y,
  };
}

export function screenToWorld(screen: Point, view: ViewTransform): Point {
  return {
    x: (screen.x - view.pan.x) / view.zoom,
    y: (screen.y - view.pan.y) / view.zoom,
  };
}
