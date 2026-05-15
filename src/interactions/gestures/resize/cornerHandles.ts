import type { ResizeAnchor } from '../types';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/** Corner resize-handle: world-space center plus the anchor that pins the opposite corner during resize. */
export interface CornerHandle {
  cx: number;
  cy: number;
  anchor: ResizeAnchor;
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

/** The corner that does NOT move under a resize gesture with the given
 *  anchor. Used by the rotated-resize math to pin a world-space invariant.
 *
 *  Convention: `anchor.x === 'min'` means the min-x (left) edge is the
 *  fixed anchor, so the fixed corner sits at `x = bounds.x` (min-x).
 *  `anchor.x === 'max'` means the max-x (right) edge is fixed, so the
 *  fixed corner sits at `x = bounds.x + bounds.width`. `'free'` on an
 *  axis means that axis doesn't move; the fixed coord is the bounds
 *  origin on that axis. */
export function fixedCornerOf(
  bounds: Bounds,
  anchor: ResizeAnchor,
): { x: number; y: number } {
  return {
    x: anchor.x === 'max' ? bounds.x + bounds.width : bounds.x,
    y: anchor.y === 'max' ? bounds.y + bounds.height : bounds.y,
  };
}
