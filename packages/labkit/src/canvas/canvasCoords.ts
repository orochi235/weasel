import { viewScreenToWorld, viewWorldToScreen } from '@weasel-js/core';
import type { Point, ViewTransform2D } from '../instrument/types';
import { frameLocalToWorld, toCameraView } from './cameraView';
import { DEFAULT_FRAME, type WorldFrame } from './worldSpec';

/** Project a world point into screen coordinates under a labkit view: core's
 *  `viewWorldToScreen` through {@link toCameraView}.
 *
 *  `frame` is the instrument's declared coordinate system, resolved against the
 *  viewport; omitting it gives labkit's original one — origin at the top-left,
 *  y downward. */
export function labWorldToScreen(
  world: Point,
  view: ViewTransform2D,
  frame: WorldFrame = DEFAULT_FRAME,
): Point {
  return viewWorldToScreen(toCameraView(view, frame), frameLocalToWorld(world, frame));
}

/** Unproject a screen point back to world coordinates under a labkit view. */
export function labScreenToWorld(
  screen: Point,
  view: ViewTransform2D,
  frame: WorldFrame = DEFAULT_FRAME,
): Point {
  return frameLocalToWorld(viewScreenToWorld(toCameraView(view, frame), screen), frame);
}
