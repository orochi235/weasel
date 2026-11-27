import type { Bounds } from './fitViewToBounds';
import type { View } from './view';
import { canvasToClient } from '@weasel-js/routing';
import { poseFrameOf, viewWorldToScreen, type Rect } from '@weasel-js/geom';
import { axisAlignedBounds } from 'core/geometry/unionBounds';

/** Options for {@link sceneNodeClientRect}. */
export interface SceneNodeClientRectOptions {
  /** Node (or container) id to locate. */
  id: string;
  /**
   * Resolve an id to its world-space bounds, or null when unknown.
   * Typically adapts a pose resolver (e.g. from `composeSelectionPose`):
   * `(id) => { const p = resolvePose(id); return p ? boundsOfPath(p) : null; }`
   * — a rect pose can be returned directly: one carrying a `rotation` or
   * `transform` is projected by the AABB of the box it is drawn in.
   */
  getWorldBounds: (id: string) => Bounds | null;
  /** Current viewport. */
  view: View;
  /** The canvas element — supplies the client-coordinate origin. */
  canvas: Element;
}

/** Client-coordinate rect (viewport space) — the shape `Callout`'s `anchorRect` expects. */
export type NodeClientRect = Rect;

/**
 * Project a scene node's world bounds to client (viewport) coordinates,
 * e.g. to anchor a `Callout` at a canvas-drawn object. Snapshot
 * semantics: the rect is where the node is *now* — it does not track
 * subsequent pan/zoom or scene mutations.
 */
export function sceneNodeClientRect(opts: SceneNodeClientRectOptions): NodeClientRect | null {
  const found = opts.getWorldBounds(opts.id);
  if (found === null) return null;
  const bounds = poseFrameOf(found) ? axisAlignedBounds(found) : found;
  const { x: x0, y: y0 } = viewWorldToScreen(opts.view, bounds);
  // The extent is scaled on its own: far from the origin, x + width can round away the width.
  const x1 = x0 + bounds.width * opts.view.scale.x;
  const y1 = y0 + bounds.height * opts.view.scale.y;
  // Through the canvas's own scale, which an ancestor transform sets.
  const [cx0, cy0] = canvasToClient(opts.canvas, x0, y0);
  const [cx1, cy1] = canvasToClient(opts.canvas, x1, y1);
  // A flipped (y-up) axis draws the box's far world edge first on screen.
  return {
    x: Math.min(cx0, cx1),
    y: Math.min(cy0, cy1),
    width: Math.abs(cx1 - cx0),
    height: Math.abs(cy1 - cy0),
  };
}
