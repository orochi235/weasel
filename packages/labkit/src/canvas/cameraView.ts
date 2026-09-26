/**
 * labkit's camera as a weasel `View`, so core's viewport actions drive it.
 *
 * labkit places a world point on screen at
 * `originPx + pan + zoom * (x, yDir * y)`. A weasel `View` places one at
 * `(p - (x, y)) * scale`. Over *frame-local* coordinates — the world with `y`
 * multiplied by `yDir` — the two are the same affine map, which is all a pan
 * or a zoom about a screen point needs.
 */
import type { View } from '@weasel-js/core';
import type { Point, ViewTransform } from '../instrument/types';
import { normalize2DView } from '../state/view';
import { DEFAULT_FRAME, type WorldFrame } from './worldSpec';

/** The weasel `View` equal to `view` under `frame`. */
export function toCameraView(view: ViewTransform, frame: WorldFrame = DEFAULT_FRAME): View {
  const v = normalize2DView(view);
  return {
    x: -(frame.originPx.x + v.pan.x) / v.zoom,
    y: -(frame.originPx.y + v.pan.y) / v.zoom,
    scale: { x: v.zoom, y: v.zoom },
  };
}

/** The labkit camera equal to weasel `view` under `frame`. */
export function fromCameraView(view: View, frame: WorldFrame = DEFAULT_FRAME): ViewTransform {
  const zoom = view.scale.x;
  return {
    zoom,
    pan: { x: -view.x * zoom - frame.originPx.x, y: -view.y * zoom - frame.originPx.y },
  };
}

/** A frame-local point in the instrument's world, and back — the map is its
 *  own inverse. */
export function frameLocalToWorld(p: Point, frame: WorldFrame = DEFAULT_FRAME): Point {
  return { x: p.x, y: p.y * frame.yDir };
}

/**
 * `next` with its zoom held to [`min`, `max`], about the screen point the step
 * from `prev` was anchored on, so a zoom that hits a bound stays anchored where
 * the pointer is. A pan (equal scales) passes through.
 */
export function clampZoomAbout(prev: View, next: View, min: number, max: number): View {
  const s0 = prev.scale.x;
  const s1 = next.scale.x;
  const clamped = Math.min(max, Math.max(min, s1));
  if (clamped === s1) return next;
  if (s0 === s1) return { ...next, scale: { x: clamped, y: clamped } };
  // The screen point both views agree on: p / s0 + x0 = p / s1 + x1.
  const inv = 1 / s0 - 1 / s1;
  const px = (next.x - prev.x) / inv;
  const py = (next.y - prev.y) / inv;
  // The same point under the clamped scale.
  return {
    x: prev.x + px / s0 - px / clamped,
    y: prev.y + py / s0 - py / clamped,
    scale: { x: clamped, y: clamped },
  };
}
