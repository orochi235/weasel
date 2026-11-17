/**
 * Path edit and the commands on paths, as `<SceneCanvas features>` presets:
 * `pathsPreset` for all of them, or one at a time. `pathToolsPreset` includes it.
 */
import type { FeaturePreset } from '@weasel-js/core';
import { anchorsTool } from './pathEdit/anchorsTool';
import { cutPathAtAnchorAction, deleteAnchorsAction, marqueeAnchorsAction, selectAnchorAction } from './pathEdit/anchorEditing';
import {
  nudgeAnchorsDownAction, nudgeAnchorsLeftAction, nudgeAnchorsRightAction, nudgeAnchorsUpAction,
} from './pathEdit/anchorNudge';
import { makeHandlesSymmetricAction, retractHandlesAction } from './pathEdit/anchorHandles';
import { setAnchorFieldAction } from './pathEdit/anchorFields';
import { averageAnchorsAction, joinAnchorsAction } from './pathEdit/anchorJoin';
import { bendSegmentAction } from './pathEdit/bendSegment';
import { enterPathEditAction } from './pathEdit/enterPathEdit';
import { exitPathEditAction } from './pathEdit/exitPathEdit';
import { editAnchorsAction } from './pathEdit/editAnchors/editAnchors';
import { insertPathAnchorAction } from './pathEdit/insertPathAnchor';
import { createOutlinesAction } from './outlines/createOutlinesAction';
import { outlineStrokeAction } from './outlines/outlineStrokeAction';
import { joinPathsAction, snipAtCrossingsAction } from './pathCommands/cutJoin';
import { offsetPathAction, simplifyPathAction } from './pathCommands/simplifyOffset';

/**
 * The path-edit keys that share a key with a node-level action: anchor nudging
 * and deleting, and Escape out of path edit. Each is tried ahead of its twin,
 * which is enabled whenever anything is selected.
 */
export const anchorKeysPreset: FeaturePreset = {
  id: 'anchorKeys',
  label: 'Anchor keys',
  refines: ['nudge', 'delete', 'escape'],
  actions: [
    nudgeAnchorsUpAction, nudgeAnchorsDownAction, nudgeAnchorsLeftAction, nudgeAnchorsRightAction,
    deleteAnchorsAction, exitPathEditAction,
  ],
};

/** Text and strokes to paths. */
export const outlinesPreset: FeaturePreset = {
  id: 'outlines', label: 'Outlines', actions: [createOutlinesAction, outlineStrokeAction],
};

/** Entering path edit, and editing anchors, handles, and segments in it, with
 *  the `anchors` tool path edit starts on. */
export const pathEditPreset: FeaturePreset = {
  id: 'pathEdit',
  label: 'Path edit',
  tools: [anchorsTool],
  actions: [
    editAnchorsAction, enterPathEditAction, insertPathAnchorAction, bendSegmentAction, cutPathAtAnchorAction,
    retractHandlesAction, makeHandlesSymmetricAction, averageAnchorsAction, joinAnchorsAction, setAnchorFieldAction,
    marqueeAnchorsAction, selectAnchorAction,
  ],
};

/** Simplify, offset, snip at crossings, and join paths. */
export const pathCommandsPreset: FeaturePreset = {
  id: 'pathCommands',
  label: 'Path commands',
  actions: [simplifyPathAction, offsetPathAction, snipAtCrossingsAction, joinPathsAction],
};

/** Path-edit entry, anchor editing, the path commands, and outlines. */
export const pathsPreset: FeaturePreset = {
  id: 'paths',
  label: 'Paths',
  includes: [anchorKeysPreset, outlinesPreset, pathEditPreset, pathCommandsPreset],
};
