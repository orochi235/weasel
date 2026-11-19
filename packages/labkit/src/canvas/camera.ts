import { normalizeZoom, zoomAt } from '@weasel-js/core';
import type { Point, ViewTransform2D } from '../instrument/types';
import { fromCameraView, toCameraView } from './cameraView';
import { DEFAULT_FRAME, type ViewportSize, type WorldFrame } from './worldSpec';

/** Bounds and coordinate system a {@link labZoomAt} works in. */
export interface LabZoomAtOptions {
  /** The instrument's coordinate system, resolved against the viewport.
   *  Omitted, `at` is measured from the element's top-left. */
  frame?: WorldFrame;
  min?: number;
  max?: number;
}

/**
 * Zoom a labkit view by `factor` about a fixed point, so whatever world
 * coordinate `at` was over stays under it: core's `zoomAt` through
 * {@link toCameraView}, unbounded unless `min` / `max` say otherwise.
 *
 * `at` is in the element's own pixels — a cursor position, or the center of a
 * lens. The clamp is applied before the pan is solved, so a zoom that hits a
 * bound still anchors on the zoom it actually reached.
 */
export function labZoomAt(
  view: ViewTransform2D,
  factor: number,
  at: Point,
  { frame = DEFAULT_FRAME, min = 0, max = Number.POSITIVE_INFINITY }: LabZoomAtOptions = {},
): ViewTransform2D {
  return fromCameraView(zoomAt(toCameraView(view, frame), at, factor, { min, max }), frame);
}

/** The view that puts a world point at the center of a `size` viewport, at
 *  `zoom`. What a lens showing a region around one point renders through. */
export function centerOn(
  world: Point,
  zoom: number,
  size: ViewportSize,
  frame: WorldFrame = DEFAULT_FRAME,
): ViewTransform2D {
  const z = normalizeZoom(zoom);
  return {
    zoom: z,
    pan: {
      x: size.width / 2 - frame.originPx.x - world.x * z,
      y: size.height / 2 - frame.originPx.y - world.y * z * frame.yDir,
    },
  };
}
