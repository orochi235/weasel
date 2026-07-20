import type { Bounds } from './fitViewToBounds';
import type { View } from './view';
import { viewToTransform } from './view';
import { worldToScreen } from './viewTransform';

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
  const [sx, sy] = worldToScreen(bounds.x, bounds.y, t);
  const canvasRect = opts.canvas.getBoundingClientRect();
  return {
    x: canvasRect.left + sx,
    y: canvasRect.top + sy,
    width: bounds.width * opts.view.scale.x,
    height: bounds.height * opts.view.scale.y,
  };
}
