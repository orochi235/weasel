import type { Bounds } from './fitViewToBounds';
import type { View } from './view';
import { viewToTransform } from './view';
import { worldToScreen } from './viewTransform';
import { canvasToClient } from '@weasel-js/routing';

/** Options for {@link sceneNodeClientRect}. */
export interface SceneNodeClientRectOpts {
  /** Node (or container) id to locate. */
  id: string;
  /**
   * Resolve an id to its world-space AABB, or null when unknown.
   * Typically adapts a pose resolver (e.g. from `composeSelectionPose`):
   * `(id) => { const p = resolvePose(id); return p ? boundsOfPath(p) : null; }`
   * — for rect poses the pose is its own AABB and can be returned directly.
   */
  getWorldBounds: (id: string) => Bounds | null;
  /** Current viewport. */
  view: View;
  /** The canvas element — supplies the client-coordinate origin. */
  canvas: Element;
}

/** Client-coordinate rect (viewport space) — the shape `Callout`'s `anchorRect` expects. */
export interface NodeClientRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Project a scene node's world AABB to client (viewport) coordinates,
 * e.g. to anchor a `Callout` at a canvas-drawn object. Snapshot
 * semantics: the rect is where the node is *now* — it does not track
 * subsequent pan/zoom or scene mutations.
 */
export function sceneNodeClientRect(opts: SceneNodeClientRectOpts): NodeClientRect | null {
  const bounds = opts.getWorldBounds(opts.id);
  if (bounds === null) return null;
  const t = viewToTransform(opts.view);
  const [x0, y0] = worldToScreen(bounds.x, bounds.y, t);
  const [x1, y1] = worldToScreen(bounds.x + bounds.width, bounds.y + bounds.height, t);
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
