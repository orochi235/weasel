import { normalizeZoom } from '@weasel-js/core';
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
  const current = normalizeZoom(view.zoom);
  const zoom = normalizeZoom(
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? 0, current * factor)),
  );
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
  const z = normalizeZoom(zoom);
  return {
    zoom: z,
    pan: {
      x: size.width / 2 - frame.originPx.x - world.x * z,
      y: size.height / 2 - frame.originPx.y - world.y * z * frame.yDir,
    },
  };
}
