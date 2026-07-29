/**
 * Base sizes for grabbable chrome, in CSS pixels at `targetScale = 1`.
 *
 * These were six separate literal `8`s and one `24` scattered across
 * `SceneCanvas`, `features/selection/overlay`, `affordances/cornerResize`,
 * `canvas/affordanceAt`, and `interactions/actions/rotate/handle`. They are
 * consolidated here because paint and hit-test MUST scale together: chrome
 * you can see but cannot grab is the exact failure `chrome-caps` exists to
 * make impossible, and duplicated literals in five files is how that failure
 * gets reintroduced.
 *
 * Multiply by `DeviceProfile.targetScale` at the point of use — the profile
 * is a runtime value, these are not.
 */

/** Selection corner-handle visual size and hit radius. */
export const HANDLE_BASE_PX = 8;

/** Path anchor / control-point hit radius. */
export const ANCHOR_HIT_BASE_PX = 8;

/** Distance from a selection's top edge to the rotation handle's center. */
export const ROTATION_HANDLE_BASE_PX = 24;
