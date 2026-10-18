import type { ResizeAnchor } from '../../gestures/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { pxExtentIn, type TargetTransform } from 'core/geometry/targetFrame';

/** Corner resize-handle: world-space center plus the anchor that pins the opposite corner during resize. */
export interface CornerHandle {
  cx: number;
  cy: number;
  anchor: ResizeAnchor;
}

/** Which AABB edge a corner sits on, per axis. `'min'` = the x/y origin
 *  edge; `'max'` = the origin + extent edge. */
export type CornerEdge = 'min' | 'max';

/** Where a resize handle sits on one axis: on an edge (`CornerEdge`), or
 *  `'mid'`way between them, which is what makes a handle an edge handle. */
export type HandleEdge = CornerEdge | 'mid';

/** One entry of the canonical resize-handle layout: where the handle sits,
 *  which edges it pins, and what a press on it reports. */
export interface ResizeHandleAnchor {
  /** Where the handle sits on x (`'min'` = left, `'mid'` = centered, `'max'` = right). */
  xEdge: HandleEdge;
  /** Where the handle sits on y (`'min'` = top, `'mid'` = centered, `'max'` = bottom). */
  yEdge: HandleEdge;
  /** Anchor that pins the opposite side: the axis-wise opposite of each
   *  edge the handle sits on, and `'free'` on an axis it sits mid-way along,
   *  which the drag leaves alone. */
  anchor: ResizeAnchor;
  /** Affordance/handle discriminator string for this handle. */
  kind: string;
  /** Short positional tag (`'<xEdge>-<yEdge>'`), e.g. `'min-max'`. */
  tag: string;
}

/** A corner entry of {@link RESIZE_HANDLE_ANCHORS}. */
export interface CornerAnchor extends ResizeHandleAnchor {
  /** Which x-edge the corner sits on (`'min'` = left, `'max'` = right). */
  xEdge: CornerEdge;
  /** Which y-edge the corner sits on (`'min'` = top, `'max'` = bottom). */
  yEdge: CornerEdge;
}

/**
 * The single ordered resize-handle table: the four corners (TL, TR, BL, BR),
 * then the four edge midpoints (top, right, bottom, left). Order is
 * **load-bearing**: the resize-handle affordance, the selection overlay and
 * `cornerResizeHandles` all iterate it in this sequence, so the i-th handle
 * means the same thing to each. A corner pins the diagonally opposite corner;
 * an edge pins the opposite edge and leaves the other axis free.
 */
export const RESIZE_HANDLE_ANCHORS: readonly ResizeHandleAnchor[] = [
  { xEdge: 'min', yEdge: 'min', anchor: { x: 'max', y: 'max' }, kind: 'handle:top-left',     tag: 'min-min' },
  { xEdge: 'max', yEdge: 'min', anchor: { x: 'min', y: 'max' }, kind: 'handle:top-right',    tag: 'max-min' },
  { xEdge: 'min', yEdge: 'max', anchor: { x: 'max', y: 'min' }, kind: 'handle:bottom-left',  tag: 'min-max' },
  { xEdge: 'max', yEdge: 'max', anchor: { x: 'min', y: 'min' }, kind: 'handle:bottom-right', tag: 'max-max' },
  { xEdge: 'mid', yEdge: 'min', anchor: { x: 'free', y: 'max' }, kind: 'handle:top',         tag: 'mid-min' },
  { xEdge: 'max', yEdge: 'mid', anchor: { x: 'min', y: 'free' }, kind: 'handle:right',       tag: 'max-mid' },
  { xEdge: 'mid', yEdge: 'max', anchor: { x: 'free', y: 'min' }, kind: 'handle:bottom',      tag: 'mid-max' },
  { xEdge: 'min', yEdge: 'mid', anchor: { x: 'max', y: 'free' }, kind: 'handle:left',        tag: 'min-mid' },
];

/** True for a corner entry of {@link RESIZE_HANDLE_ANCHORS}. */
export function isCornerHandle(entry: ResizeHandleAnchor): entry is CornerAnchor {
  return entry.xEdge !== 'mid' && entry.yEdge !== 'mid';
}

/** The corner entries of {@link RESIZE_HANDLE_ANCHORS}, in its order. */
export const CORNER_ANCHORS: readonly CornerAnchor[] = RESIZE_HANDLE_ANCHORS.filter(isCornerHandle);

/** An edge handle sits this many hit radii on screen from each corner of the
 *  side it is on, at least: under that, it would crowd the corners and leave
 *  the body too little room to be grabbed. At the default 8 px radius, a
 *  side must span 48 px. */
export const EDGE_HANDLE_MIN_RADII = 6;

/** Whether a body this size, in its own frame `xf`, has room for edge
 *  handles on screen: each side spans {@link EDGE_HANDLE_MIN_RADII} times
 *  `radiusPx`. Both sides, because a short side puts the two handles across
 *  it over the middle of the body. */
export function edgeHandlesFit(
  body: { width: number; height: number },
  xf: TargetTransform,
  scale: { x: number; y: number },
  radiusPx: number,
): boolean {
  const floor = pxExtentIn(EDGE_HANDLE_MIN_RADII * radiusPx, scale, xf);
  return Math.abs(body.width) >= floor.x && Math.abs(body.height) >= floor.y;
}

/** How a canvas lays out its resize handles. `hitRadiusPx` is the one size
 *  the edge-handle decision keys on, because a handle exists to be grabbed:
 *  paint and hit-test both read it, so no handle is drawn that cannot be
 *  grabbed or grabbable where none is drawn. */
export interface ResizeHandleLayout {
  /** Whether the edge midpoints get handles at all. */
  edges: boolean;
  /** The handles' hit radius, screen px. */
  hitRadiusPx: number;
}

/** The handles a body gets in `layout`: every corner, then the edge
 *  midpoints when the layout has them and {@link edgeHandlesFit} at its hit
 *  radius. The answer the selection overlay paints; the hit-test reaches the
 *  same one through the regions' `edgeOf`. */
export function resizeHandlesFor(
  layout: ResizeHandleLayout,
  body: { width: number; height: number },
  xf: TargetTransform,
  scale: { x: number; y: number },
): readonly ResizeHandleAnchor[] {
  return layout.edges && edgeHandlesFit(body, xf, scale, layout.hitRadiusPx)
    ? RESIZE_HANDLE_ANCHORS
    : CORNER_ANCHORS;
}

/** Resolve a handle's position for the given bounds, in the bounds' frame:
 *  `'min'` → the origin edge, `'max'` → origin + extent, `'mid'` → between. */
export function handlePoint(
  bounds: Bounds,
  entry: Pick<ResizeHandleAnchor, 'xEdge' | 'yEdge'>,
): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width * EDGE_FRACTION[entry.xEdge],
    y: bounds.y + bounds.height * EDGE_FRACTION[entry.yEdge],
  };
}

const EDGE_FRACTION: Record<HandleEdge, number> = { min: 0, mid: 0.5, max: 1 };

/** @deprecated Use {@link handlePoint}, which also places edge handles. */
export const cornerPoint: (
  bounds: Bounds,
  entry: Pick<CornerAnchor, 'xEdge' | 'yEdge'>,
) => { x: number; y: number } = handlePoint;

/** Standard 4-corner resize-handle layout: each corner pins the opposite
 *  corner via an anchor of `{x: 'min'|'max', y: 'min'|'max'}` so dragging it
 *  scales the box from the fixed opposite corner. Decodes {@link CORNER_ANCHORS}
 *  against `bounds`; edge handles are the affordance's, which knows the view. */
export function cornerResizeHandles(bounds: Bounds): CornerHandle[] {
  return CORNER_ANCHORS.map((c) => {
    const p = handlePoint(bounds, c);
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
 *  axis (an edge handle's other axis) pins the bounds' center on it: a drag
 *  leaves that extent alone, and an aspect lock grows it about the center. */
export function fixedCornerOf(
  bounds: Bounds,
  anchor: ResizeAnchor,
): { x: number; y: number } {
  return handlePoint(bounds, { xEdge: PINNED[anchor.x], yEdge: PINNED[anchor.y] });
}

const PINNED: Record<ResizeAnchor['x'], HandleEdge> = { min: 'min', max: 'max', free: 'mid' };
