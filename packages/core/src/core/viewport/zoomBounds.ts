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
export const DEFAULT_MAX_ZOOM = 8;

/**
 * The smallest zoom magnitude a view can hold, in `View.scale` units.
 *
 * A view's zoom is always finite and at least this far from 0. Nothing can be
 * drawn or picked through a zoom of 0, and every screen↔world conversion
 * divides by it, so it is ruled out where views are made rather than handled
 * by each conversion. This is validity, not an interaction limit: that is
 * {@link DEFAULT_MIN_ZOOM}, which a consumer may set far below.
 */
export const ZOOM_FLOOR = 1e-9;

/**
 * The one rule for a zoom magnitude: a finite number no smaller than
 * {@link ZOOM_FLOOR}. Anything else (0, negative, NaN, ±Infinity) becomes the
 * floor. Dev builds warn once when a zoom that was never valid arrives; a
 * positive zoom that merely undershoots the floor clamps silently.
 */
export function normalizeZoom(zoom: number): number {
  if (zoom >= ZOOM_FLOOR && zoom < Infinity) return zoom;
  if (!(zoom > 0) || zoom === Infinity) warnInvalidView(`a zoom of ${zoom}`);
  return ZOOM_FLOOR;
}

let warned = false;

/** @internal Once per session, in dev builds only. */
export function warnInvalidView(what: string): void {
  if (warned || !IS_DEV) return;
  warned = true;
  console.warn(
    `[weasel] a view was given ${what} and has been clamped. A view's zoom is ` +
    'always positive and finite, and its position finite; see ZOOM_FLOOR.',
  );
}

/** `import.meta.env.DEV` read through a cast, as in SceneCanvas.tsx. */
const IS_DEV: boolean = (() => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
})();
