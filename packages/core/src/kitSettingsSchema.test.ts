import { describe, it, expect } from 'vitest';
import {
  DOUBLE_CLICK_MAX_MS, DOUBLE_CLICK_MAX_PX, DRAG_THRESHOLD_PX, LONG_PRESS_MS, TAP_THRESHOLD_PX,
} from '@weasel-js/gestures';
import type { KitSettings } from '@weasel-js/react';
import { ANCHOR_HIT_BASE_PX, HANDLE_BASE_PX, ROTATION_HANDLE_BASE_PX } from 'core/device/targets';
import { DEFAULT_VIEW_ANIMATION_MS } from 'core/viewport/useViewAnimation';
import { DEFAULT_PICK_TOLERANCE_PX } from 'canvas/SceneCanvas/useSceneSelectTool';
import { SEGMENT_HIT_PX } from 'interactions/actions/defaults/segmentUnder';
import { ANCHOR_CLICK_PX } from 'interactions/actions/defaults/anchorEditing';
import {
  ANCHOR_RADIUS_PX, CLOSE_HINT_RADIUS_PX, HANDLE_DOT_RADIUS_PX, PEN_CLOSE_HIT_PX,
} from 'domains/paths/penPreviewLayer';
import { SLICE_CLOSE_HIT_PX, VERTEX_RADIUS_PX } from 'tools/builtin/slice/useSliceTool';
import { DEFAULT_SNAP_PX } from 'domains/snap/session2d';
import { coreKitSettingsSchema } from './kitSettingsSchema';

const CONSTANTS: Pick<KitSettings, 'gestures' | 'view'> & { targets: Record<string, number> } = {
  gestures: {
    doubleClickMs: DOUBLE_CLICK_MAX_MS,
    doubleClickPx: DOUBLE_CLICK_MAX_PX,
    longPressMs: LONG_PRESS_MS,
    tapPx: TAP_THRESHOLD_PX,
    dragPx: DRAG_THRESHOLD_PX,
    keymapUnbound: 'modal',
  },
  targets: {
    handlePx: HANDLE_BASE_PX,
    anchorHitPx: ANCHOR_HIT_BASE_PX,
    rotationDistancePx: ROTATION_HANDLE_BASE_PX,
    segmentHitPx: SEGMENT_HIT_PX,
    anchorClickPx: ANCHOR_CLICK_PX,
    pickTolerancePx: DEFAULT_PICK_TOLERANCE_PX,
    snapPx: DEFAULT_SNAP_PX,
    penAnchorRadiusPx: ANCHOR_RADIUS_PX,
    penHandleDotRadiusPx: HANDLE_DOT_RADIUS_PX,
    penCloseHintRadiusPx: CLOSE_HINT_RADIUS_PX,
    penCloseHitPx: PEN_CLOSE_HIT_PX,
    sliceVertexRadiusPx: VERTEX_RADIUS_PX,
    sliceCloseHitPx: SLICE_CLOSE_HIT_PX,
  },
  view: { animationMs: DEFAULT_VIEW_ANIMATION_MS },
};

describe('coreKitSettingsSchema', () => {
  it('defaults every leaf to its constant, at its KitSettings path', () => {
    const defaults = Object.fromEntries(Object.entries(coreKitSettingsSchema.children).map(([area, group]) => [
      area,
      Object.fromEntries(Object.entries(group.children).map(([key, leaf]) => [key, leaf.default])),
    ]));
    expect(defaults).toEqual(CONSTANTS);
  });
});
