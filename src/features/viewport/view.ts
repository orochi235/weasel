import type { ViewTransform } from './viewTransform';

/**
 * Viewport state in camera-position semantics. `view = {x, y}` is the
 * **world point currently rendered at the canvas top-left**. So:
 *
 *   screenX = worldX - view.x
 *   worldX  = screenX + view.x
 *
 * Phase 2b is pan-only — there is no scale field. Phase 2c will extend
 * this shape with `scale` (and the formulas with multiplication).
 */
export interface View {
  x: number;
  y: number;
}

/**
 * Bridge `View` into the legacy `ViewTransform` shape so chrome can keep
 * calling `worldToScreen` / `screenToWorld`. `View` and `ViewTransform`
 * use opposite sign conventions for the translation half (`view.x` is
 * camera position; `panX` is canvas translation), so the adapter flips
 * the sign. `zoom` is hard-coded to 1 — Phase 2c lifts that.
 */
export function viewToTransform(view: View): ViewTransform {
  return { panX: -view.x || 0, panY: -view.y || 0, zoom: 1 };
}
