import type { ViewTransform } from './viewTransform';

/**
 * Viewport state. `(view.x, view.y)` is the **world point currently
 * rendered at the canvas top-left**; `view.scale.x` / `view.scale.y` is
 * pixels per world unit on each axis (default `{ x: 1, y: 1 }`). So:
 *
 *   screenX = (worldX - view.x) * view.scale.x
 *   screenY = (worldY - view.y) * view.scale.y
 *   worldX  = screenX / view.scale.x + view.x
 *   worldY  = screenY / view.scale.y + view.y
 *
 * `scale` is always a 2-vector. Input convenience types
 * {@link ZoomFactor} and {@link ZoomBound} let callers pass a scalar
 * when they want both axes treated the same.
 */
export interface View {
  x: number;
  y: number;
  scale: { x: number; y: number };
}

/**
 * Input convenience for zoom primitives. A `number` is treated as a
 * uniform factor applied to both axes; a `{x, y}` vector applies
 * per-axis factors.
 */
export type ZoomFactor = number | { x: number; y: number };

/**
 * Input convenience for zoom-clamp ranges. A `number` is applied as the
 * same bound on both axes; a `{x, y}` vector applies per-axis bounds.
 */
export type ZoomBound = number | { x: number; y: number };

/**
 * Bridge `View` into the legacy `ViewTransform` shape so chrome can keep
 * calling `worldToScreen` / `screenToWorld`. `View` and `ViewTransform`
 * use opposite sign conventions for the translation half (`view.x` is
 * camera position; `panX` is canvas translation), so the adapter flips
 * the sign and multiplies by per-axis scale.
 */
export function viewToTransform(view: View): ViewTransform {
  // `+ 0` coerces `-0 → 0` without swallowing NaN (matches viewToMat3).
  return {
    panX: -view.x * view.scale.x + 0,
    panY: -view.y * view.scale.y + 0,
    zoom: { x: view.scale.x, y: view.scale.y },
  };
}
