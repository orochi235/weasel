import { normalizeZoom } from '@weasel-js/geom';
import { hasExtent } from './fitViewToBounds';

/**
 * Compute the largest uniform zoom (px per content-unit) that fits a content
 * rect of `contentW x contentH` (in content units) into a viewport rect of
 * `availW x availH` (in pixels). Content with no extent on one axis is fitted
 * along the other.
 *
 * `clamp` optionally bounds the resulting zoom to [min, max]. `null` when there
 * is nothing to fit (`hasExtent`): the caller that owns the viewport resolves
 * that to the view Cmd-0 gives.
 */
export function fitZoom(
  availW: number,
  availH: number,
  contentW: number,
  contentH: number,
  clamp?: { min?: number; max?: number },
): number | null {
  if (!hasExtent({ width: contentW, height: contentH })) return null;
  const raw = Math.min(
    contentW > 0 ? availW / contentW : Infinity,
    contentH > 0 ? availH / contentH : Infinity,
  );
  const min = clamp?.min ?? -Infinity;
  const max = clamp?.max ?? Infinity;
  return normalizeZoom(Math.min(max, Math.max(min, raw)));
}

/**
 * Compute zoom + pan that centers `contentW x contentH` (content units) inside
 * a `viewportW x viewportH` (pixel) rect. `paddingPx` is uniform pixel padding
 * on every side. `null` when there is nothing to fit, as {@link fitZoom}.
 */
export function fitToBounds(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  paddingPx = 0,
  clamp?: { min?: number; max?: number },
): { zoom: number; panX: number; panY: number } | null {
  const availW = Math.max(1, viewportW - paddingPx * 2);
  const availH = Math.max(1, viewportH - paddingPx * 2);
  const zoom = fitZoom(availW, availH, contentW, contentH, clamp);
  if (zoom === null) return null;
  const contentPxW = Math.max(0, contentW) * zoom;
  const contentPxH = Math.max(0, contentH) * zoom;
  return {
    zoom,
    panX: (viewportW - contentPxW) / 2,
    panY: (viewportH - contentPxH) / 2,
  };
}
