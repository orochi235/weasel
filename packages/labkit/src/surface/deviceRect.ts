import type { Rect } from './rect';

/**
 * A DOM rect as a GL viewport rect: origin at the bottom-left, every edge snapped
 * to the device-pixel grid. Still CSS pixels, because three.js applies its own
 * pixel ratio — snapping here is what stops a tile and its neighbour rounding
 * apart and leaving a hairline column between them.
 */
export function toDeviceRect(rect: Rect, surfaceHeight: number, dpr: number): Rect {
  const snap = (v: number) => Math.round(v * dpr) / dpr;
  const x = snap(rect.x);
  const y = snap(surfaceHeight - rect.y - rect.h);
  return {
    x,
    y,
    w: snap(rect.x + rect.w) - x,
    h: snap(surfaceHeight - rect.y) - y,
  };
}
