import type { SurfaceContribution } from '../surfaceContribution';

/** `<SceneCanvas longPress>`. */
export interface SceneCanvasLongPress {
  /**
   * Shown while a long-press is held and some binding would fire on it.
   * Default: a ring that fills around the press point
   * (`createLongPressFeedbackContribution()`), static under
   * `prefers-reduced-motion`. `false` shows nothing; a contribution replaces
   * it, reading the `longPress` dep. Installed beside `ambient` and beside a `tools`
   * takeover, unless the takeover's ambient holds an entry of the same id.
   */
  feedback?: boolean | SurfaceContribution;
  /** Default true. A long-press some binding handled pulses
   *  `navigator.vibrate` briefly, for touch and pen, where the API exists. */
  haptics?: boolean;
  /** Hold time in ms. Default `LONG_PRESS_MS` (500). */
  duration?: number;
}
