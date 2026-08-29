/**
 * Base sizes for grabbable chrome, in CSS pixels at `targetScale = 1`, and the
 * one accessor that resolves them for a live pointer type.
 *
 * Paint and hit-test MUST scale together: chrome you can see but cannot grab
 * is the exact failure `chrome-caps` exists to make impossible, and a literal
 * `8` copied into a fifth file is how that failure gets reintroduced. So every
 * kit-internal use site goes through {@link targetSizesPx} — the selection
 * overlay's handle size, `buildAffordanceAt`'s hit radii, and the slops debug
 * overlay all read the same object. The bare constants below stay exported for
 * consumers, who get the unscaled numbers they always got.
 */

const BASE_PX = {
  handle: 8,
  anchor: 8,
  rotationDistance: 24,
} as const;

/** Selection corner-handle visual size and hit radius. */
export const HANDLE_BASE_PX = BASE_PX.handle;

/** Path anchor / control-point hit radius. */
export const ANCHOR_HIT_BASE_PX = BASE_PX.anchor;

/** Distance from a selection's top edge to the rotation handle's center. */
export const ROTATION_HANDLE_BASE_PX = BASE_PX.rotationDistance;

/** Grabbable-chrome sizes resolved for one pointer type, in CSS pixels. */
export interface TargetSizesPx {
  /** Corner-handle visual size and hit radius. */
  handle: number;
  /** Anchor / control-point hit radius. */
  anchor: number;
  /** Distance from a selection's top edge to the rotation handle's center,
   *  which is also the rotate band's minimum thickness. */
  rotationDistance: number;
}

/**
 * How big is grabbable chrome, in CSS pixels, for this pointer type?
 *
 * `targetScale` comes from the live {@link DeviceProfile} — 1 for a mouse,
 * {@link COARSE_TARGET_SCALE} for touch.
 */
export function targetSizesPx(targetScale = 1): TargetSizesPx {
  return {
    handle: BASE_PX.handle * targetScale,
    anchor: BASE_PX.anchor * targetScale,
    rotationDistance: BASE_PX.rotationDistance * targetScale,
  };
}
