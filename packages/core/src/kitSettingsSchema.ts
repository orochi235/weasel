import { pref, PX_UNIT } from '@weasel-js/prefs-schema';
import {
  DOUBLE_CLICK_MAX_MS, DOUBLE_CLICK_MAX_PX, DRAG_THRESHOLD_PX, LONG_PRESS_MS, TAP_THRESHOLD_PX,
} from '@weasel-js/gestures';
import { DEFAULT_KEYMAP_UNBOUND } from '@weasel-js/routing';
import { ANCHOR_HIT_BASE_PX, HANDLE_BASE_PX, ROTATION_HANDLE_BASE_PX } from 'core/device/targets';
import { DEFAULT_VIEW_ANIMATION_MS } from 'core/viewport/useViewAnimation';
import { DEFAULT_PICK_TOLERANCE_PX } from 'canvas/SceneCanvas/useScenePickers';
import { SEGMENT_HIT_PX } from 'interactions/actions/defaults/segmentUnder';
import { ANCHOR_CLICK_PX } from 'domains/paths/anchorUnder';
import { DEFAULT_SNAP_PX } from 'domains/snap/session2d';

const ms = { scale: 1, suffix: 'ms' };

const pxLeaf = (name: string, def: number, max = 48) => pref.number(name, def, { unit: PX_UNIT, min: 1, max, step: 0.5 });
const msLeaf = (name: string, def: number, min = 50, max = 2000) => pref.number(name, def, { unit: ms, min, max, step: 10 });

/**
 * Core's kit settings — gestures, core's `targets` leaves, and view — as a
 * prefs group whose paths are the `KitSettings` paths. Compose it beside the
 * other packages' groups to build a settings page.
 */
export const coreKitSettingsSchema = pref.group('Canvas', {
  gestures: pref.group('Gestures', {
    doubleClickMs: msLeaf('Double-click interval', DOUBLE_CLICK_MAX_MS),
    doubleClickPx: pxLeaf('Double-click distance', DOUBLE_CLICK_MAX_PX),
    longPressMs: msLeaf('Long-press hold', LONG_PRESS_MS),
    tapPx: pxLeaf('Tap travel', TAP_THRESHOLD_PX),
    dragPx: pxLeaf('Drag threshold', DRAG_THRESHOLD_PX),
    keymapUnbound: pref.enum('Keys a keymap does not bind', DEFAULT_KEYMAP_UNBOUND, [
      { value: 'modal', label: 'Ignore them' },
      { value: 'cascade', label: 'Close it and pass them on' },
    ]),
  }),
  targets: pref.group('Targets', {
    handlePx: pxLeaf('Selection handle', HANDLE_BASE_PX),
    anchorHitPx: pxLeaf('Anchor reach', ANCHOR_HIT_BASE_PX),
    rotationDistancePx: pxLeaf('Rotation handle distance', ROTATION_HANDLE_BASE_PX, 96),
    segmentHitPx: pxLeaf('Segment reach', SEGMENT_HIT_PX),
    anchorClickPx: pxLeaf('Anchor click reach', ANCHOR_CLICK_PX),
    pickTolerancePx: pref.number('Shape pick slop', DEFAULT_PICK_TOLERANCE_PX, { unit: PX_UNIT, min: 0, max: 24, step: 0.5 }),
    snapPx: pref.number('Snap reach', DEFAULT_SNAP_PX, { unit: PX_UNIT, min: 0, max: 48, step: 0.5 }),
  }),
  view: pref.group('View', {
    animationMs: msLeaf('Camera animation', DEFAULT_VIEW_ANIMATION_MS, 0),
  }),
});
