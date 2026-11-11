import type { View } from './view';
import { DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM, normalizeZoom } from './zoomBounds';

import type { FramedBox as Bounds } from '@weasel-js/geom';
export type { Bounds };

/** Pixel dimensions of the canvas viewport. */
export interface ViewportDims {
  width: number;
  height: number;
}

/** Options for {@link fitViewToBounds}. */
export interface FitViewToBoundsOptions {
  /** Inset (in CSS px) around the bounds. Default 16. */
  padding?: number;
  /** Defaults to the kit-wide max zoom (`DEFAULT_MAX_ZOOM`). */
  maxScale?: number;
  /** Defaults to the kit-wide min zoom (`DEFAULT_MIN_ZOOM`). */
  minScale?: number;
  /**
   * Fit mode:
   * - `'contain'` (default): uniform scale = `min(availW/w, availH/h)`. Bounds fit entirely; one axis has letterboxing.
   * - `'fill'`: uniform scale = `max(...)`. Bounds overflow viewport on one axis.
   * - `'stretch'`: per-axis scale. Bounds match viewport exactly; scale is non-uniform.
   */
  mode?: 'contain' | 'fill' | 'stretch';
  /**
   * Where bounds that overflow the viewport on an axis sit, which happens when
   * `minScale` stops the fit or `mode` is `'fill'`. `'center'` (default) shows
   * their middle; `'start'` shows their left or top edge, inset by `padding`.
   * An axis that fits is centered either way.
   */
  anchor?: 'center' | 'start';
}

/**
 * Compute the target {@link View} that fits `bounds` (world space) inside
 * `viewportDims` (CSS px). The bounds are centered in the viewport with
 * uniform padding on all sides; the resulting scale is clamped to the
 * configured min/max. Bounds with no width or no height, a lone line, are
 * fitted along the axis they have, at that axis's scale.
 *
 * `null` when there is nothing to fit: bounds with no extent on either axis,
 * or not finite. The caller that owns the viewport resolves that to the view
 * Cmd-0 gives (`resetView`). A viewport with no area cannot be fit into, and
 * returns `currentView` unchanged with a `console.warn`.
 */
export function fitViewToBounds(
  bounds: Bounds,
  viewportDims: ViewportDims,
  currentView: View,
  opts: FitViewToBoundsOptions = {},
): View | null {
  const { padding = 16, maxScale = DEFAULT_MAX_ZOOM, minScale = DEFAULT_MIN_ZOOM } = opts;

  if (!hasExtent(bounds)) return null;
  if (viewportDims.width <= 0 || viewportDims.height <= 0) {
    console.warn('[weasel] fitViewToBounds: viewport has zero or negative area; returning currentView unchanged.', viewportDims);
    return currentView;
  }

  const width = Math.max(0, bounds.width);
  const height = Math.max(0, bounds.height);
  const availW = Math.max(1, viewportDims.width - padding * 2);
  const availH = Math.max(1, viewportDims.height - padding * 2);
  // An axis with no extent takes the other's scale.
  const sx = width > 0 ? availW / width : availH / height;
  const sy = height > 0 ? availH / height : sx;

  let rawX: number;
  let rawY: number;
  switch (opts.mode ?? 'contain') {
    case 'fill': {
      const u = Math.max(sx, sy);
      rawX = u;
      rawY = u;
      break;
    }
    case 'stretch':
      rawX = sx;
      rawY = sy;
      break;
    case 'contain':
    default: {
      const u = Math.min(sx, sy);
      rawX = u;
      rawY = u;
      break;
    }
  }
  // A negative scale is a flipped (y-up) axis, which the fit keeps.
  const signX = currentView.scale.x < 0 ? -1 : 1;
  const signY = currentView.scale.y < 0 ? -1 : 1;
  const scaleX = signX * normalizeZoom(Math.min(maxScale, Math.max(minScale, rawX)));
  const scaleY = signY * normalizeZoom(Math.min(maxScale, Math.max(minScale, rawY)));

  // screenCenter = (worldCenter - view.x) * scale, solved for view.x.
  // On a flipped axis the edge drawn first on screen is the far one.
  const place = (start: number, size: number, avail: number, viewport: number, scale: number) =>
    opts.anchor === 'start' && size * Math.abs(scale) > avail + 1e-9
      ? (scale < 0 ? start + size : start) - padding / scale
      : start + size / 2 - viewport / (2 * scale);
  return {
    x: place(bounds.x, width, availW, viewportDims.width, scaleX),
    y: place(bounds.y, height, availH, viewportDims.height, scaleY),
    scale: { x: scaleX, y: scaleY },
  };
}

/** Whether `bounds` holds something to fit: finite to its far edges, with extent on at least one axis. The one
 *  rule for an empty fit, which {@link fitViewToBounds} and `fitZoom` both answer by. */
export function hasExtent(bounds: { x?: number; y?: number; width: number; height: number }): boolean {
  const { x = 0, y = 0, width, height } = bounds;
  // The far edges too: a box whose edge overflows the double range has no center to put in view.
  if (![x, y, width, height, x + width, y + height].every(Number.isFinite)) return false;
  return width > 0 || height > 0;
}
