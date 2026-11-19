/**
 * How the gesture dispatcher times, publishes and signals a long-press. The
 * press state it publishes is defined in `@weasel-js/gestures`.
 */
import type { LongPressStore } from '@weasel-js/gestures';

/** How long a handled long-press vibrates for, in ms. */
export const LONG_PRESS_HAPTIC_MS = 15;

/** How `useGestureDispatcher` times, publishes and signals a long-press. */
export interface LongPressOptions {
  /** Hold time in ms. Default the `gestures.longPressMs` kit setting, else gestures' `LONG_PRESS_MS`. */
  duration?: number;
  /**
   * Where the press being held is published: position, start time, progress,
   * and whether any binding would fire on it. `<SceneCanvas>` passes one and
   * republishes it as the `longPress` dep, which its default press ring
   * reads. Omit it and nothing is published.
   */
  state?: LongPressStore;
  /**
   * Default true. A long-press some binding handled pulses `navigator.vibrate`
   * briefly, for touch and pen pointers, where the API exists.
   */
  haptics?: boolean;
}
