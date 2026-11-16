import type {} from '@weasel-js/react';
import { pref, PX_UNIT } from '@weasel-js/prefs';
import { ANCHOR_CLICK_PX } from './pathEdit/anchorEditing';
import { ANCHOR_RADIUS_PX, CLOSE_HINT_RADIUS_PX, HANDLE_DOT_RADIUS_PX, PEN_CLOSE_HIT_PX } from './pen/penPreviewLayer';
import { SLICE_CLOSE_HIT_PX, VERTEX_RADIUS_PX } from './slice/useSliceTool';

/** The path tools' `targets` leaves: hit radii and overlay dot sizes, in CSS px. */
export interface PathToolsKitTargetSettings {
  /** Radius around an anchor that a click selects it within. */
  anchorClickPx: number;
  penAnchorRadiusPx: number;
  penHandleDotRadiusPx: number;
  penCloseHintRadiusPx: number;
  /** How near the pen's first anchor a click closes the subpath. */
  penCloseHitPx: number;
  sliceVertexRadiusPx: number;
  /** How near the knife's first point a click closes the cut. */
  sliceCloseHitPx: number;
}

declare module '@weasel-js/react' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface KitTargetSettings extends PathToolsKitTargetSettings {}
}

const pxLeaf = (name: string, def: number, max = 48) => pref.number(name, def, { unit: PX_UNIT, min: 1, max, step: 0.5 });

/** The path tools' `targets` leaves as a prefs group whose paths are the `KitSettings` paths. */
export const pathToolsKitSettingsSchema = pref.group('Path tools', {
  targets: pref.group('Targets', {
    anchorClickPx: pxLeaf('Anchor click reach', ANCHOR_CLICK_PX),
    penAnchorRadiusPx: pxLeaf('Pen anchor dot', ANCHOR_RADIUS_PX, 16),
    penHandleDotRadiusPx: pxLeaf('Pen handle dot', HANDLE_DOT_RADIUS_PX, 16),
    penCloseHintRadiusPx: pxLeaf('Pen close hint', CLOSE_HINT_RADIUS_PX, 24),
    penCloseHitPx: pxLeaf('Pen close reach', PEN_CLOSE_HIT_PX),
    sliceVertexRadiusPx: pxLeaf('Slice vertex dot', VERTEX_RADIUS_PX, 16),
    sliceCloseHitPx: pxLeaf('Slice close reach', SLICE_CLOSE_HIT_PX),
  }),
});
