/**
 * The `gestures` kit settings area. Declared here rather than in core because
 * the dispatcher reads it, and routing sits below core.
 */

import type {} from '@weasel-js/react';
import type { KeymapUnbound } from './keymaps/keymapStack';

/** Pointer gesture timings and travel; each falls back to its constant in `@weasel-js/gestures`. */
export interface GestureKitSettings {
  /** Longest gap between the clicks of a double click, in ms. */
  doubleClickMs: number;
  /** Farthest apart the clicks of a double click may land, in CSS px. */
  doubleClickPx: number;
  /** How long a touch or pen press is held to fire a long-press, in ms. */
  longPressMs: number;
  /** Farthest a multitouch tap's fingers may travel, in CSS px. */
  tapPx: number;
  /** Travel that makes a press a drag, in CSS px. */
  dragPx: number;
  /** What a key an open keymap does not bind does: `'modal'` swallows it,
   *  `'cascade'` closes the keymap and lets it through. */
  keymapUnbound: KeymapUnbound;
}

declare module '@weasel-js/react' {
  interface KitSettings {
    gestures: GestureKitSettings;
  }
}
