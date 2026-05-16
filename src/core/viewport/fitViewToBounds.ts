import type { View } from './view';

/**
 * Axis-aligned rectangle in world space. Kit-wide `Bounds` shape used by
 * selection, group, and viewport helpers. The optional `rotation` field
 * (radians, around the AABB center) lets selection chrome attach a rotated
 * orientation to an otherwise axis-aligned rect without needing a parallel
 * type.
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/** Pixel dimensions of the canvas viewport. */
export interface ViewportDims {
  width: number;
  height: number;
}

/** Options for {@link fitViewToBounds}. */
export interface FitViewToBoundsOptions {
  /** Inset (in CSS px) around the bounds. Default 16. */
  padding?: number;
  /**
   * Override the kit's system max scale. Defaults to the kit-wide max zoom
   * used by `computeWheelAction` / `useZoom` (currently `10`).
   */
  maxScale?: number;
  /**
   * Override the kit's system min scale. Defaults to the kit-wide min zoom
   * used by `computeWheelAction` / `useZoom` (currently `0.1`).
   */
  minScale?: number;
}

/**
 * System-wide max scale used by viewport fits. Mirrors `DEFAULT_MAX_ZOOM` in
 * `wheelHandler.ts` / `useZoom`. Kept private here intentionally — consumers
 * who need a custom cap should pass `maxScale` explicitly.
 */
const SYSTEM_MAX_SCALE = 10;
/** System-wide min scale. Mirrors `DEFAULT_MIN_ZOOM`. */
const SYSTEM_MIN_SCALE = 0.1;

/**
 * Compute the target {@link View} that fits `bounds` (world space) inside
 * `viewportDims` (CSS px). The bounds are centered in the viewport with
 * uniform padding on all sides; the resulting scale is clamped to the
 * configured min/max.
 *
 * View semantics: `view.x` / `view.y` is the world point currently drawn at
 * the canvas top-left, and `view.scale.{x,y}` is pixels per world unit on
 * each axis (see `view.ts`). So:
 *   screenX = (worldX - view.x) * view.scale.x
 *   screenY = (worldY - view.y) * view.scale.y
 *
 * Empty / zero-sized bounds or viewports cannot be fit — in that case this
 * returns `currentView` unchanged and logs a `console.warn`. Callers that
 * want to no-op silently can detect zero area themselves before calling.
 */
export function fitViewToBounds(
  bounds: Bounds,
  viewportDims: ViewportDims,
  currentView: View,
  opts: FitViewToBoundsOptions = {},
): View {
  const { padding = 16, maxScale = SYSTEM_MAX_SCALE, minScale = SYSTEM_MIN_SCALE } = opts;

  if (bounds.width <= 0 || bounds.height <= 0) {
    // eslint-disable-next-line no-console
    console.warn('[weasel] fitViewToBounds: bounds has zero or negative area; returning currentView unchanged.', bounds);
    return currentView;
  }
  if (viewportDims.width <= 0 || viewportDims.height <= 0) {
    // eslint-disable-next-line no-console
    console.warn('[weasel] fitViewToBounds: viewport has zero or negative area; returning currentView unchanged.', viewportDims);
    return currentView;
  }

  const availW = Math.max(1, viewportDims.width - padding * 2);
  const availH = Math.max(1, viewportDims.height - padding * 2);
  const sx = availW / bounds.width;
  const sy = availH / bounds.height;
  // 'contain' (today's behavior): uniform min of axes. The `mode` option
  // for 'fill' / 'stretch' lands in a follow-up.
  const uniform = Math.min(sx, sy);
  const scaleX = Math.min(maxScale, Math.max(minScale, uniform));
  const scaleY = scaleX;

  // Center bounds in the viewport. With view-as-camera semantics:
  //   screenCenter = (worldCenter - view.x) * scale
  //   view.x = worldCenter - viewportCenter / scale
  const worldCx = bounds.x + bounds.width / 2;
  const worldCy = bounds.y + bounds.height / 2;
  return {
    x: worldCx - viewportDims.width / (2 * scaleX),
    y: worldCy - viewportDims.height / (2 * scaleY),
    scale: { x: scaleX, y: scaleY },
  };
}
