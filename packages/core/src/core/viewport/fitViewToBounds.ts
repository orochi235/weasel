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
 * configured min/max.
 *
 * Empty / zero-sized bounds or viewports cannot be fit — in that case this
 * returns `currentView` unchanged and logs a `console.warn`.
 */
export function fitViewToBounds(
  bounds: Bounds,
  viewportDims: ViewportDims,
  currentView: View,
  opts: FitViewToBoundsOptions = {},
): View {
  const { padding = 16, maxScale = DEFAULT_MAX_ZOOM, minScale = DEFAULT_MIN_ZOOM } = opts;

  if (bounds.width <= 0 || bounds.height <= 0) {
    console.warn('[weasel] fitViewToBounds: bounds has zero or negative area; returning currentView unchanged.', bounds);
    return currentView;
  }
  if (viewportDims.width <= 0 || viewportDims.height <= 0) {
    console.warn('[weasel] fitViewToBounds: viewport has zero or negative area; returning currentView unchanged.', viewportDims);
    return currentView;
  }

  const availW = Math.max(1, viewportDims.width - padding * 2);
  const availH = Math.max(1, viewportDims.height - padding * 2);
  const sx = availW / bounds.width;
  const sy = availH / bounds.height;

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
  const scaleX = normalizeZoom(Math.min(maxScale, Math.max(minScale, rawX)));
  const scaleY = normalizeZoom(Math.min(maxScale, Math.max(minScale, rawY)));

  // screenCenter = (worldCenter - view.x) * scale, solved for view.x.
  const place = (start: number, size: number, avail: number, viewport: number, scale: number) =>
    opts.anchor === 'start' && size * scale > avail + 1e-9
      ? start - padding / scale
      : start + size / 2 - viewport / (2 * scale);
  return {
    x: place(bounds.x, bounds.width, availW, viewportDims.width, scaleX),
    y: place(bounds.y, bounds.height, availH, viewportDims.height, scaleY),
    scale: { x: scaleX, y: scaleY },
  };
}
