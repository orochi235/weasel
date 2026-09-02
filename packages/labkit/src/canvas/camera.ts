import type { Point, ViewTransform } from '../instrument/types';
import { DEFAULT_FRAME, type ViewportSize, type WorldFrame } from './worldSpec';

/** Bounds and coordinate system a {@link zoomAt} works in. */
export interface ZoomAtOptions {
  /** The instrument's coordinate system, resolved against the viewport.
   *  Omitted, `at` is measured from the element's top-left. */
  frame?: WorldFrame;
  min?: number;
  max?: number;
}

function usableZoom(zoom: number): number {
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

/**
 * Zoom a view by `factor` about a fixed point, so whatever world coordinate
 * `at` was over stays under it.
 *
 * `at` is in the element's own pixels — a cursor position, or the centre of a
 * lens. The clamp is applied before the pan is solved, so a zoom that hits a
 * bound still anchors on the zoom it actually reached.
 */
export function zoomAt(
  view: ViewTransform,
  factor: number,
  at: Point,
  { frame = DEFAULT_FRAME, min, max }: ZoomAtOptions = {},
): ViewTransform {
  // `pan` is measured from the frame's origin, so anchoring at the raw point
  // drifts by `(1 - ratio) * originPx` per step on any frame that moves it.
  const anchorX = at.x - frame.originPx.x;
  const anchorY = at.y - frame.originPx.y;
  const current = usableZoom(view.zoom);
  const zoom = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? 0, current * factor));
  const ratio = zoom / current;
  return {
    zoom,
    pan: {
      x: anchorX - (anchorX - view.pan.x) * ratio,
      y: anchorY - (anchorY - view.pan.y) * ratio,
    },
  };
}

/** The view that puts a world point at the centre of a `size` viewport, at
 *  `zoom`. What a lens showing a region around one point renders through. */
export function centerOn(
  world: Point,
  zoom: number,
  size: ViewportSize,
  frame: WorldFrame = DEFAULT_FRAME,
): ViewTransform {
  return {
    zoom,
    pan: {
      x: size.width / 2 - frame.originPx.x - world.x * zoom,
      y: size.height / 2 - frame.originPx.y - world.y * zoom * frame.yDir,
    },
  };
}
