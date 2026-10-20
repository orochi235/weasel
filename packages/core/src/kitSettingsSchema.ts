import { pref } from '@weasel-js/prefs';
import {
  DOUBLE_CLICK_MAX_MS, DOUBLE_CLICK_MAX_PX, DRAG_THRESHOLD_PX, LONG_PRESS_MS, TAP_THRESHOLD_PX,
} from '@weasel-js/gestures';
import { ANCHOR_HIT_BASE_PX, HANDLE_BASE_PX, ROTATION_HANDLE_BASE_PX } from 'core/device/targets';
import { DEFAULT_VIEW_ANIMATION_MS } from 'core/viewport/useViewAnimation';
import { DEFAULT_PICK_TOLERANCE_PX } from 'canvas/SceneCanvas/useSceneSelectTool';
import { SEGMENT_HIT_PX } from 'interactions/actions/defaults/segmentUnder';
import { ANCHOR_CLICK_PX } from 'interactions/actions/defaults/anchorEditing';
import {
  ANCHOR_RADIUS_PX, CLOSE_HINT_RADIUS_PX, HANDLE_DOT_RADIUS_PX, PEN_CLOSE_HIT_PX,
} from 'features/paths/penPreviewLayer';
import { DEFAULT_SNAP_PX } from 'features/snap/session2d';
import { SLICE_CLOSE_HIT_PX, VERTEX_RADIUS_PX } from 'tools/builtin/slice/useSliceTool';

const ms = { scale: 1, suffix: 'ms' };
const px = { scale: 1, suffix: 'px' };
const pxLeaf = (name: string, def: number, max = 48) => pref.number(name, def, { unit: px, min: 1, max, step: 0.5 });
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
  }),
  targets: pref.group('Targets', {
    handlePx: pxLeaf('Selection handle', HANDLE_BASE_PX),
    anchorHitPx: pxLeaf('Anchor reach', ANCHOR_HIT_BASE_PX),
    rotationDistancePx: pxLeaf('Rotation handle distance', ROTATION_HANDLE_BASE_PX, 96),
    segmentHitPx: pxLeaf('Segment reach', SEGMENT_HIT_PX),
    anchorClickPx: pxLeaf('Anchor click reach', ANCHOR_CLICK_PX),
    pickTolerancePx: pref.number('Shape pick slop', DEFAULT_PICK_TOLERANCE_PX, { unit: px, min: 0, max: 24, step: 0.5 }),
    snapPx: pref.number('Snap reach', DEFAULT_SNAP_PX, { unit: px, min: 0, max: 48, step: 0.5 }),
    penAnchorRadiusPx: pxLeaf('Pen anchor dot', ANCHOR_RADIUS_PX, 16),
    penHandleDotRadiusPx: pxLeaf('Pen handle dot', HANDLE_DOT_RADIUS_PX, 16),
    penCloseHintRadiusPx: pxLeaf('Pen close hint', CLOSE_HINT_RADIUS_PX, 24),
    penCloseHitPx: pxLeaf('Pen close reach', PEN_CLOSE_HIT_PX),
    sliceVertexRadiusPx: pxLeaf('Slice vertex dot', VERTEX_RADIUS_PX, 16),
    sliceCloseHitPx: pxLeaf('Slice close reach', SLICE_CLOSE_HIT_PX),
  }),
  view: pref.group('View', {
    animationMs: msLeaf('Camera animation', DEFAULT_VIEW_ANIMATION_MS, 0),
  }),
});
