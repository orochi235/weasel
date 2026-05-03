import type { ResizeAnchor } from '../types';

export interface CornerHandle {
  cx: number;
  cy: number;
  anchor: ResizeAnchor;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Standard 4-corner resize-handle layout: each corner pins the opposite
 *  corner via an anchor of `{x: 'min'|'max', y: 'min'|'max'}` so dragging it
 *  scales the box from the fixed opposite corner. */
export function cornerResizeHandles(bounds: Bounds): CornerHandle[] {
  const { x, y, width, height } = bounds;
  return [
    { cx: x,         cy: y,          anchor: { x: 'max', y: 'max' } },
    { cx: x + width, cy: y,          anchor: { x: 'min', y: 'max' } },
    { cx: x,         cy: y + height, anchor: { x: 'max', y: 'min' } },
    { cx: x + width, cy: y + height, anchor: { x: 'min', y: 'min' } },
  ];
}

/** Square hit-test for a handle: returns true if `(px, py)` is within
 *  `radius` of the handle center on both axes. */
export function hitCornerHandle(
  handle: CornerHandle,
  px: number,
  py: number,
  radius: number,
): boolean {
  return Math.abs(px - handle.cx) <= radius
    && Math.abs(py - handle.cy) <= radius;
}
