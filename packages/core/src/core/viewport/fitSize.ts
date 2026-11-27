import { hasExtent } from './fitViewToBounds';
import { clampZoom, DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM } from './zoomBounds';

/**
 * Compute the largest uniform zoom (px per content-unit) that fits a content
 * rect of `contentW x contentH` (in content units) into a viewport rect of
 * `availW x availH` (in pixels). Content with no extent on one axis is fitted
 * along the other.
 *
 * `clamp` bounds the resulting zoom to [min, max], each defaulting to the
 * kit-wide clamp (`DEFAULT_MIN_ZOOM`, `DEFAULT_MAX_ZOOM`). `null` when there
 * is nothing to fit (`hasExtent`): the caller that owns the viewport resolves
 * that to the view Cmd-0 gives. Throws a `RangeError` for a viewport with no
 * area, which has no fit; wait for layout before fitting.
 */
export function fitZoom(
  availW: number,
  availH: number,
  contentW: number,
  contentH: number,
  clamp?: { min?: number; max?: number },
): number | null {
  checkViewportArea('fitZoom', availW, availH);
  if (!hasExtent({ width: contentW, height: contentH })) return null;
  const raw = Math.min(
    contentW > 0 ? availW / contentW : Infinity,
    contentH > 0 ? availH / contentH : Infinity,
  );
  const min = clamp?.min ?? DEFAULT_MIN_ZOOM;
  const max = clamp?.max ?? DEFAULT_MAX_ZOOM;
  return clampZoom(raw, min, max);
}

/**
 * Compute zoom + pan that centers `contentW x contentH` (content units) inside
 * a `viewportW x viewportH` (pixel) rect. `paddingPx` is uniform pixel padding
 * on every side, and `fill` the fraction of each padded axis the content may
 * take (`0.85` leaves a 15% margin), in (0, 1]; a `RangeError` otherwise. `null` when there is nothing to fit, as
 * {@link fitZoom}, and a `RangeError` for a viewport with no area, as there.
 */
export function fitSize(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  paddingPx = 0,
  clamp?: { min?: number; max?: number },
  fill = 1,
): { zoom: number; panX: number; panY: number } | null {
  checkViewportArea('fitSize', viewportW, viewportH);
  if (!(fill > 0 && fill <= 1)) {
    throw new RangeError(`fitSize: fill is the share of the viewport the content may take, in (0, 1], not ${fill}`);
  }
  const availW = Math.max(1, viewportW - paddingPx * 2) * fill;
  const availH = Math.max(1, viewportH - paddingPx * 2) * fill;
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

function checkViewportArea(who: string, width: number, height: number): void {
  if (!(width > 0 && height > 0 && width < Infinity && height < Infinity)) {
    throw new RangeError(`${who}: a ${width} x ${height} viewport has no area to fit content into`);
  }
}
