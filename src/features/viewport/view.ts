import type { ViewTransform } from './viewTransform';

/**
 * Viewport state in camera-position semantics. `view = {x, y}` is the
 * **world point currently rendered at the canvas top-left**; `view.scale`
 * is pixels per world unit (default 1). So:
 *
 *   screenX = (worldX - view.x) * view.scale
 *   worldX  = screenX / view.scale + view.x
 */
export interface View {
  x: number;
  y: number;
  scale: number;
}

/**
 * Bridge `View` into the legacy `ViewTransform` shape so chrome can keep
 * calling `worldToScreen` / `screenToWorld`. `View` and `ViewTransform`
 * use opposite sign conventions for the translation half (`view.x` is
 * camera position; `panX` is canvas translation), so the adapter flips
 * the sign and multiplies by scale.
 */
export function viewToTransform(view: View): ViewTransform {
  const s = view.scale;
  return { panX: -view.x * s || 0, panY: -view.y * s || 0, zoom: s };
}
