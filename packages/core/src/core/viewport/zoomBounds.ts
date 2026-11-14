import { normalizeZoom, ZOOM_FLOOR } from '@weasel-js/geom';
import { isDev } from '@weasel-js/registry';

/**
 * The kit's system-wide zoom clamp, in `View.scale` units (pixels per world
 * unit): `1` is 100%, `0.1` is 10%, `8` is 800%.
 *
 * Every zoom path defaults from these — `zoomAt`, the `viewport.zoom` and
 * pinch actions, `fitViewToBounds`, `computeWheelAction`. They
 * used to carry two disagreeing pairs, so a fit could legally land at 10x
 * and the next pinch frame would clamp it back to 8x.
 */
export const DEFAULT_MIN_ZOOM = 0.1;
/** Upper end of the kit's default zoom clamp — 800%. See {@link DEFAULT_MIN_ZOOM}. */
export const DEFAULT_MAX_ZOOM = 8;

export { normalizeZoom, ZOOM_FLOOR };

let warned = false;

/** @internal Once per session, in dev builds only. */
export function warnInvalidView(what: string): void {
  if (warned || !isDev()) return;
  warned = true;
  console.warn(
    `[weasel] a view was given ${what} and has been clamped. A view's zoom is ` +
    'always positive and finite, and its position finite; see ZOOM_FLOOR.',
  );
}
