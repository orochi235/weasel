import type { ViewTransform } from './viewTransform';
import type { View } from '@weasel-js/geom';
import { meanScale } from '@weasel-js/geom';
import { normalizeZoom, warnInvalidView } from './zoomBounds';

/**
 * Every view the kit keeps is total: each `scale` axis is finite with a
 * magnitude of at least `ZOOM_FLOOR` and `x` / `y` are finite. A negative
 * axis is a flipped one (y-up), not a degenerate one, and keeps its sign.
 * Canvases, views, and animations pass what they are given through
 * {@link normalizeView}, so screen/world conversion never divides by zero.
 */
export type { View };

/** A zoom factor: a `number` applies to both axes, a `{x, y}` vector per axis. */
export type ZoomFactor = number | { x: number; y: number };

/** A zoom-clamp bound: a `number` applies to both axes, a `{x, y}` vector per axis. */
export type ZoomBound = number | { x: number; y: number };

/**
 * Bridge `View` into the legacy `ViewTransform` shape. The two use opposite
 * sign conventions for the translation half: `view.x` is camera position;
 * `panX` is canvas translation.
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
 */
export function viewZoom(view: View): number {
  return meanScale(view.scale);
}

/** Whether two views are the same camera, whatever objects hold them. */
export function sameView(a: View, b: View): boolean {
  return a.x === b.x && a.y === b.y && a.scale.x === b.scale.x && a.scale.y === b.scale.y;
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
