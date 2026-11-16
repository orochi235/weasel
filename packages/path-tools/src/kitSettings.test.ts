import { describe, expect, it } from 'vitest';
import { pathToolsKitSettingsSchema } from './kitSettings';
import { ANCHOR_CLICK_PX } from './pathEdit/anchorEditing';
import { ANCHOR_RADIUS_PX, CLOSE_HINT_RADIUS_PX, HANDLE_DOT_RADIUS_PX, PEN_CLOSE_HIT_PX } from './pen/penPreviewLayer';
import { SLICE_CLOSE_HIT_PX, VERTEX_RADIUS_PX } from './slice/useSliceTool';

describe('pathToolsKitSettingsSchema', () => {
  it('defaults every leaf to its constant, at its KitSettings path', () => {
    const leaves = pathToolsKitSettingsSchema.children.targets.children;
    const defaults = Object.fromEntries(Object.entries(leaves).map(([key, leaf]) => [key, leaf.default]));
    expect(defaults).toEqual({
      anchorClickPx: ANCHOR_CLICK_PX,
      penAnchorRadiusPx: ANCHOR_RADIUS_PX,
      penHandleDotRadiusPx: HANDLE_DOT_RADIUS_PX,
      penCloseHintRadiusPx: CLOSE_HINT_RADIUS_PX,
      penCloseHitPx: PEN_CLOSE_HIT_PX,
      sliceVertexRadiusPx: VERTEX_RADIUS_PX,
      sliceCloseHitPx: SLICE_CLOSE_HIT_PX,
    });
  });
});
