import type { Point, ViewTransform } from '../instrument/types';

/** How an instrument's world sits on the canvas, independent of the camera.
 *  The defaults reproduce the convention labkit shipped before this existed:
 *  world (0,0) at the element's top-left, y growing downward. */
export interface WorldSpec {
  /** Where world (0,0) sits at `pan` zero, as a fraction of the viewport.
   *  `{x:0,y:0}` top-left (default); `{x:0.5,y:0.5}` centre. */
  origin?: Point;
  /** Which way the world y axis runs on screen. Default `'down'`. */
  yAxis?: 'down' | 'up';
}

/** A viewport's CSS-pixel size. */
export interface ViewportSize {
  width: number;
  height: number;
}

/** A `WorldSpec` resolved against a viewport: what the coordinate helpers,
 *  the camera and the wheel all read. */
export interface WorldFrame {
  /** Screen position of world (0,0) at `pan` zero. */
  originPx: Point;
  yDir: 1 | -1;
}

export const DEFAULT_FRAME: WorldFrame = { originPx: { x: 0, y: 0 }, yDir: 1 };

export function resolveFrame(spec: WorldSpec | undefined, size: ViewportSize): WorldFrame {
  if (!spec) return DEFAULT_FRAME;
  const origin = spec.origin ?? { x: 0, y: 0 };
  return {
    originPx: { x: origin.x * size.width, y: origin.y * size.height },
    yDir: spec.yAxis === 'up' ? -1 : 1,
  };
}

/** Put a 2D context into the instrument's world coordinates, so a layer's
 *  `draw` works in them. Must stay the exact inverse of `screenToWorld`. */
export function applyCamera(
  ctx: CanvasRenderingContext2D,
  view: ViewTransform,
  frame: WorldFrame = DEFAULT_FRAME,
): void {
  ctx.translate(frame.originPx.x + view.pan.x, frame.originPx.y + view.pan.y);
  ctx.scale(view.zoom, view.zoom * frame.yDir);
}
