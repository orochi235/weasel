import type { ViewTransform } from './viewTransform';
import type { View } from '@weasel-js/routing';
import { normalizeZoom, warnInvalidView } from './zoomBounds';

/**
 * `View` is declared in `@weasel-js/routing` — the dispatcher and every
 * viewport action are typed in it. Re-exported here, where core's own call
 * sites have always named it.
 *
 * Core holds the invariant behind the shape: every view the kit keeps is
 * total, so each `scale` axis is finite with a magnitude of at least
 * `ZOOM_FLOOR` and `x` / `y` are finite. A negative axis is a flipped one
 * (y-up), not a degenerate one, and keeps its sign. Canvases, views and
 * animations pass what they are given through {@link normalizeView}, so
 * screen/world conversion never divides by zero.
 *
 * `scale` is always a 2-vector. Input convenience types {@link ZoomFactor}
 * and {@link ZoomBound} let callers pass a scalar when they want both axes
 * treated the same.
 */
export type { View };

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

/**
 * How far `view` is zoomed in, as one number — the geometric mean of its two
 * axes, so a uniform view reports its own scale and a stretched one reports
 * the scale that covers the same area.
 *
 * What a `RuleCtx` carries, because the only rule that asks about the
 * viewport asks for a threshold rather than a camera.
 */
export function viewZoom(view: View): number {
  const { x, y } = view.scale;
  return x === y ? x : Math.sqrt(x * y);
}

/**
 * `view` inside the invariant {@link View} documents: a zero or non-finite
 * scale axis becomes `ZOOM_FLOOR`, a negative one keeps its sign, and a
 * non-finite translation becomes 0. Returns `view` itself when it already
 * holds, so a valid view keeps its identity.
 */
export function normalizeView(view: View): View {
  const sx = normalizeAxis(view.scale.x);
  const sy = normalizeAxis(view.scale.y);
  const x = finiteTranslation(view.x);
  const y = finiteTranslation(view.y);
  if (sx === view.scale.x && sy === view.scale.y && x === view.x && y === view.y) return view;
  return { x, y, scale: { x: sx, y: sy } };
}

function normalizeAxis(s: number): number {
  return s < 0 && s > -Infinity ? -normalizeZoom(-s) : normalizeZoom(s);
}

function finiteTranslation(v: number): number {
  if (Number.isFinite(v)) return v;
  warnInvalidView(`a position of ${v}`);
  return 0;
}
