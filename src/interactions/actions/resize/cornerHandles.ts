import type { ResizeAnchor } from '../../gestures/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/** Corner resize-handle: world-space center plus the anchor that pins the opposite corner during resize. */
export interface CornerHandle {
  cx: number;
  cy: number;
  anchor: ResizeAnchor;
}

/** Which AABB edge a corner sits on, per axis. `'min'` = the x/y origin
 *  edge; `'max'` = the origin + extent edge. */
export type CornerEdge = 'min' | 'max';

/** One entry of the canonical 4-corner resize layout. The single source of
 *  truth for "which corner maps to which anchor / handle-kind". */
export interface CornerAnchor {
  /** Which x-edge the corner sits on (`'min'` = left, `'max'` = right). */
  xEdge: CornerEdge;
  /** Which y-edge the corner sits on (`'min'` = top, `'max'` = bottom). */
  yEdge: CornerEdge;
  /** Anchor that pins the diagonally-opposite (fixed) corner. Always the
   *  axis-wise opposite of `{xEdge, yEdge}`. */
  anchor: ResizeAnchor;
  /** Affordance/handle discriminator string for this corner. */
  kind: string;
  /** Short positional tag (`'<xEdge>-<yEdge>'`), e.g. `'min-max'`. */
  tag: string;
}

/**
 * The single ordered corner→anchor table. Order is **load-bearing**: every
 * consumer iterates it in this sequence (TL, TR, BL, BR) so positional
 * meaning (the i-th handle / `kind` / `tag`) stays consistent across the
 * resize-handle affordance, the affordance-hit classifier, and
 * `cornerResizeHandles`. Each corner's `anchor` names the diagonally
 * opposite corner, so dragging the corner scales the box from that fixed
 * point.
 */
export const CORNER_ANCHORS: readonly CornerAnchor[] = [
  { xEdge: 'min', yEdge: 'min', anchor: { x: 'max', y: 'max' }, kind: 'handle:top-left',     tag: 'min-min' },
  { xEdge: 'max', yEdge: 'min', anchor: { x: 'min', y: 'max' }, kind: 'handle:top-right',    tag: 'max-min' },
  { xEdge: 'min', yEdge: 'max', anchor: { x: 'max', y: 'min' }, kind: 'handle:bottom-left',  tag: 'min-max' },
  { xEdge: 'max', yEdge: 'max', anchor: { x: 'min', y: 'min' }, kind: 'handle:bottom-right', tag: 'max-max' },
];

/** Resolve a corner's world-space position for the given bounds. `xEdge`
 *  `'max'` → `x + width`; `yEdge` `'max'` → `y + height`. */
export function cornerPoint(
  bounds: Bounds,
  entry: Pick<CornerAnchor, 'xEdge' | 'yEdge'>,
): { x: number; y: number } {
  return {
    x: entry.xEdge === 'max' ? bounds.x + bounds.width : bounds.x,
    y: entry.yEdge === 'max' ? bounds.y + bounds.height : bounds.y,
  };
}

/** Standard 4-corner resize-handle layout: each corner pins the opposite
 *  corner via an anchor of `{x: 'min'|'max', y: 'min'|'max'}` so dragging it
 *  scales the box from the fixed opposite corner. Decodes {@link CORNER_ANCHORS}
 *  against `bounds`. */
export function cornerResizeHandles(bounds: Bounds): CornerHandle[] {
  return CORNER_ANCHORS.map((c) => {
    const p = cornerPoint(bounds, c);
    return { cx: p.x, cy: p.y, anchor: c.anchor };
  });
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
