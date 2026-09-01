/**
 * The kit's system-wide zoom clamp, in `View.scale` units (pixels per world
 * unit): `1` is 100%, `0.1` is 10%, `8` is 800%.
 *
 * Every zoom path defaults from these — `zoomAt`, the `viewport.zoom` and
 * pinch actions, `fitViewToBounds`, `computeWheelAction`, `useZoom`. They
 * used to carry two disagreeing pairs, so a fit could legally land at 10x
 * and the next pinch frame would clamp it back to 8x.
 */
export const DEFAULT_MIN_ZOOM = 0.1;
export const DEFAULT_MAX_ZOOM = 8;
