import { viewScreenToWorld } from '@weasel-js/geom';
import { normalizeView, type View, type ZoomFactor, type ZoomBound } from './view';
import { DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM, normalizeZoom } from './zoomBounds';

/** Optional clamp bounds for `zoomAt`. Defaults: {@link DEFAULT_MIN_ZOOM} /
 *  {@link DEFAULT_MAX_ZOOM} (per axis). */
export interface ZoomClampOptions {
  min?: ZoomBound;
  max?: ZoomBound;
}

/** Bound the *magnitude* of `scale × factor`, keeping the direction of `scale`.
 *  `scale.y < 0` is how a `View` spells a y-up camera, so clamping the signed
 *  value would flip the axis, and so would reading the sign of a product a
 *  factor of 0 made `-0`. */
function clampScale(scale: number, factor: number, min: number, max: number): number {
  const magnitude = normalizeZoom(Math.min(max, Math.max(min, Math.abs(scale * factor))));
  return scale < 0 ? -magnitude : magnitude;
}

/** A factor that is no magnitude, `NaN` or negative, zooms nothing: a negative one would turn the axis over. */
function zoomBy(factor: number): number {
  return factor >= 0 ? factor : 1;
}

/** Which axes a zoom scales. */
export type ZoomAxis = 'both' | 'x' | 'y';

/** `factor` held to one axis: the other axis's factor is 1, so `zoomAt` leaves
 *  its scale and its translation where they were. */
export function axisZoomFactor(factor: number, axis: ZoomAxis): ZoomFactor {
  if (axis === 'x') return { x: factor, y: 1 };
  if (axis === 'y') return { x: 1, y: factor };
  return factor;
}

/**
 * Pure zoom primitive. Returns a new `View` whose `scale` is multiplied
 * by `factor` (per-axis, clamped) and whose translation is adjusted so
 * that the world point currently under `anchor` (screen coords relative
 * to the canvas top-left) stays under the same screen pixel after the
 * zoom — independently on each axis.
 *
 * `factor: number` means "apply uniformly to both axes". `factor: {x, y}`
 * applies per-axis factors. Likewise for `opts.min` / `opts.max`.
 */
export function zoomAt(
  input: View,
  anchor: { x: number; y: number },
  factor: ZoomFactor,
  opts?: ZoomClampOptions,
): View {
  const view = normalizeView(input);
  const fx = zoomBy(typeof factor === 'number' ? factor : factor.x);
  const fy = zoomBy(typeof factor === 'number' ? factor : factor.y);
  const minX = typeof opts?.min === 'number' ? opts.min : opts?.min?.x ?? DEFAULT_MIN_ZOOM;
  const minY = typeof opts?.min === 'number' ? opts.min : opts?.min?.y ?? DEFAULT_MIN_ZOOM;
  const maxX = typeof opts?.max === 'number' ? opts.max : opts?.max?.x ?? DEFAULT_MAX_ZOOM;
  const maxY = typeof opts?.max === 'number' ? opts.max : opts?.max?.y ?? DEFAULT_MAX_ZOOM;

  const nextX = clampScale(view.scale.x, fx, minX, maxX);
  const nextY = clampScale(view.scale.y, fy, minY, maxY);

  // An axis whose scale does not change keeps its translation exactly, rather than one a round trip has rounded.
  const world = viewScreenToWorld(view, anchor);
  return {
    scale: { x: nextX, y: nextY },
    x: nextX === view.scale.x ? view.x : anchored(view.x, world.x - anchor.x / nextX),
    y: nextY === view.scale.y ? view.y : anchored(view.y, world.y - anchor.y / nextY),
  };
}

/** The translation that holds the anchor, or, when the anchor is not finite or the world point under it overflows,
 *  the one holding the canvas's own corner: what a zoom about `{ x: 0, y: 0 }` leaves. */
function anchored(corner: number, held: number): number {
  return Number.isFinite(held) ? held : corner;
}
