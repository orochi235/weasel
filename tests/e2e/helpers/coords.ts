export interface ViewLike { x: number; y: number; scale: { x: number; y: number } }
export interface CanvasRect { left: number; top: number; width: number; height: number }

/** Convert a scene-space point to CSS pixels (relative to the viewport).
 *  Matches weasel's view convention: drawn = (scene - view.xy) * view.scale,
 *  then offset by the canvas's bounding rect. */
export function sceneToCss(
  [sx, sy]: readonly [number, number],
  view: ViewLike,
  rect: CanvasRect,
): [number, number] {
  return [
    rect.left + (sx - view.x) * view.scale.x,
    rect.top + (sy - view.y) * view.scale.y,
  ];
}
