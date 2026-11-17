/**
 * The `gestures` kit settings area. Declared here rather than in core because
 * the dispatcher reads it, and routing sits below core.
 */

import {
  DOUBLE_CLICK_MAX_MS, DOUBLE_CLICK_MAX_PX, DRAG_THRESHOLD_PX, LONG_PRESS_MS, TAP_THRESHOLD_PX,
} from '@weasel-js/gestures';
import { pref, PX_UNIT, type PrefValuesOf } from '@weasel-js/prefs-schema';
import type {} from '@weasel-js/react';
import type { KeymapUnbound } from './keymaps/keymapStack';

/** What a key an open keymap does not bind does when neither the keymap nor the `gestures.keymapUnbound` kit setting says. */
export const DEFAULT_KEYMAP_UNBOUND: KeymapUnbound = 'modal';

const ms = { scale: 1, suffix: 'ms' };
const pxLeaf = (name: string, def: number, description: string) =>
  pref.number(name, def, { description, unit: PX_UNIT, min: 1, max: 48, step: 0.5 });
const msLeaf = (name: string, def: number, description: string) =>
  pref.number(name, def, { description, unit: ms, min: 50, max: 2000, step: 10 });

/** Pointer gesture timings and travel, each falling back to its constant in `@weasel-js/gestures`, as a
 *  prefs group whose paths are the `KitSettings` paths under `gestures`. */
export const gestureKitSettingsSchema = pref.group('Gestures', {
  doubleClickMs: msLeaf('Double-click interval', DOUBLE_CLICK_MAX_MS, 'Longest gap between the clicks of a double click.'),
  doubleClickPx: pxLeaf('Double-click distance', DOUBLE_CLICK_MAX_PX, 'Farthest apart the clicks of a double click may land.'),
  longPressMs: msLeaf('Long-press hold', LONG_PRESS_MS, 'How long a touch or pen press is held to fire a long-press.'),
  tapPx: pxLeaf('Tap travel', TAP_THRESHOLD_PX, "Farthest a multitouch tap's fingers may travel."),
  dragPx: pxLeaf('Drag threshold', DRAG_THRESHOLD_PX, 'Travel that makes a press a drag.'),
  keymapUnbound: pref.enum<KeymapUnbound>('Keys a keymap does not bind', DEFAULT_KEYMAP_UNBOUND, [
    { value: 'modal', label: 'Ignore them' },
    { value: 'cascade', label: 'Close it and pass them on' },
  ], { description: 'Whether an open keymap swallows a key it does not bind, or closes and lets it through.' }),
});

/** The `gestures` area's values. */
export type GestureKitSettings = PrefValuesOf<typeof gestureKitSettingsSchema>;

declare module '@weasel-js/react' {
  interface KitSettings {
    gestures: GestureKitSettings;
  }
}
