import { pref, PX_UNIT } from '@weasel-js/prefs-schema';
import { gestureKitSettingsSchema } from '@weasel-js/routing';
import { ANCHOR_HIT_BASE_PX, HANDLE_BASE_PX, ROTATION_HANDLE_BASE_PX } from 'core/device/targets';
import { DEFAULT_VIEW_ANIMATION_MS } from 'core/viewport/useViewAnimation';
import { DEFAULT_PICK_TOLERANCE_PX } from 'canvas/SceneCanvas/useScenePickers';
import { SEGMENT_HIT_PX } from 'interactions/actions/defaults/segmentUnder';
import { ANCHOR_CLICK_PX } from 'domains/paths/anchorUnder';
import { DEFAULT_SNAP_PX } from 'domains/snap/session2d';

const ms = { scale: 1, suffix: 'ms' };

const pxLeaf = (name: string, def: number, description: string, max = 48) =>
  pref.number(name, def, { description, unit: PX_UNIT, min: 1, max, step: 0.5 });

/**
 * Core's kit settings — gestures, core's `targets` leaves, and view — as a
 * prefs group whose paths are the `KitSettings` paths. Compose it beside the
 * other packages' groups to build a settings page.
 */
export const coreKitSettingsSchema = pref.group('Canvas', {
  gestures: gestureKitSettingsSchema,
  targets: pref.group('Targets', {
    handlePx: pxLeaf('Selection handle', HANDLE_BASE_PX, 'Selection corner-handle size and hit radius, before device scaling.'),
    anchorHitPx: pxLeaf('Anchor reach', ANCHOR_HIT_BASE_PX, 'Path anchor and control-point hit radius, before device scaling.'),
    rotationDistancePx: pxLeaf(
      'Rotation handle distance', ROTATION_HANDLE_BASE_PX,
      "Distance from a selection's top edge to the rotation handle, before device scaling.", 96,
    ),
    segmentHitPx: pxLeaf('Segment reach', SEGMENT_HIT_PX, 'Reach of a path segment being edited.'),
    anchorClickPx: pxLeaf('Anchor click reach', ANCHOR_CLICK_PX, 'Radius around an anchor that a click selects it within.'),
    pickTolerancePx: pref.number('Shape pick slop', DEFAULT_PICK_TOLERANCE_PX, {
      description: "Grab slop around a shape's outline.", unit: PX_UNIT, min: 0, max: 24, step: 0.5,
    }),
    snapPx: pref.number('Snap reach', DEFAULT_SNAP_PX, {
      description: 'How near a snap target pulls a point, for a snap source that sets no reach of its own.',
      unit: PX_UNIT, min: 0, max: 48, step: 0.5,
    }),
  }),
  view: pref.group('View', {
    animationMs: pref.number('Camera animation', DEFAULT_VIEW_ANIMATION_MS, {
      description: 'How long an animated camera move takes.', unit: ms, min: 0, max: 2000, step: 10,
    }),
  }),
});
