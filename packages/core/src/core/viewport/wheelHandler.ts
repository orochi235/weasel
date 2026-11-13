/**
 * The kit's one wheel convention, as pure functions over `View`.
 *
 * ## Modifiers
 * - bare wheel → pan
 * - shift+wheel → horizontal pan (mouse wheels emit only `deltaY`)
 * - Cmd/Ctrl+wheel → zoom, anchored under the pointer. Ctrl also covers the
 *   trackpad pinch, which browsers deliver as ctrl+wheel.
 *
 * ## Coordinates
 * `View.x` / `View.y` are world-space, so a pan delta — screen pixels, as the
 * DOM reports them — is divided by `View.scale` before it lands. The zoom
 * anchor is canvas-local: client coords minus the canvas's bounding rect.
 */

import type { View } from './view';
import { zoomAt, type ZoomClampOptions } from './zoomAt';

/** Multiplicative zoom applied per 100 px of wheel `deltaY`. */
export const WHEEL_ZOOM_STEP = 1.1;

/** A wheel event, decoupled from the DOM `WheelEvent` shape for testability. */
export interface WheelInput {
  deltaX: number;
  deltaY: number;
  /** Zoom anchor, canvas-local: client coords minus the canvas's rect. */
  x: number;
  y: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/** Which axes a wheel pan is allowed to move, and whether `deltaY` is routed
 *  into the x axis (shift+wheel). An axis lock outranks `swapAxis`. */
export interface WheelPanOptions {
  axis?: 'both' | 'x' | 'y';
  swapAxis?: boolean;
}

/** Zoom multiplier for one wheel sample. Reciprocal in `deltaY`, so scrolling
 *  a distance and back returns to the scale you started from. */
export function wheelZoomFactor(deltaY: number): number {
  return Math.pow(WHEEL_ZOOM_STEP, -deltaY / 100);
}

/** Zoom one wheel sample about `anchor` (canvas-local pixels). */
export function wheelZoom(
  view: View,
  anchor: { x: number; y: number },
  deltaY: number,
  clamp?: ZoomClampOptions,
): View {
  return zoomAt(view, anchor, wheelZoomFactor(deltaY), clamp);
}

/** Pan by one wheel sample. `delta` is in screen pixels. */
export function wheelPan(
  view: View,
  delta: { deltaX: number; deltaY: number },
  opts: WheelPanOptions = {},
): View {
  const axis = opts.axis ?? 'both';
  const swapped = opts.swapAxis === true;
  // Shift+wheel wants a horizontal pan, but a mouse wheel only emits deltaY.
  const screenX = swapped ? (delta.deltaX !== 0 ? delta.deltaX : delta.deltaY) : delta.deltaX;
  const screenY = swapped ? 0 : delta.deltaY;
  return {
    scale: view.scale,
    x: axis === 'y' ? view.x : panned(view.x, screenX / view.scale.x),
    y: axis === 'x' ? view.y : panned(view.y, screenY / view.scale.y),
  };
}

/** `at` moved by `by`, or left where it is when the move is not finite or carries it past the double range. */
function panned(at: number, by: number): number {
  const next = at + by;
  return Number.isFinite(next) ? next : at;
}

/** Pure reducer: the whole wheel convention in one call. */
export function computeWheelAction(
  view: View,
  input: WheelInput,
  clamp?: ZoomClampOptions,
  opts: Pick<WheelPanOptions, 'axis'> = {},
): View {
  if (input.ctrlKey || input.metaKey) {
    return wheelZoom(view, { x: input.x, y: input.y }, input.deltaY, clamp);
  }
  return wheelPan(view, input, { axis: opts.axis, swapAxis: input.shiftKey === true });
}
