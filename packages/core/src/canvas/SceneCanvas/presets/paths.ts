import {
  cutPathAtAnchorAction, deleteAnchorsAction, marqueeAnchorsAction,
  nudgeAnchorsDownAction, nudgeAnchorsLeftAction, nudgeAnchorsRightAction, nudgeAnchorsUpAction,
  selectAnchorAction,
} from 'interactions/actions/defaults/anchorEditing';
import { makeHandlesSymmetricAction, retractHandlesAction } from 'interactions/actions/defaults/anchorHandles';
import { setAnchorFieldAction } from 'interactions/actions/defaults/anchorFields';
import { averageAnchorsAction, joinAnchorsAction } from 'interactions/actions/defaults/anchorJoin';
import { bendSegmentAction } from 'interactions/actions/defaults/bendSegment';
import { enterPathEditAction } from 'interactions/actions/defaults/enterPathEdit';
import { exitPathEditAction } from 'interactions/actions/defaults/exitPathEdit';
import { editAnchorsAction } from 'interactions/actions/edit-anchors/action';
import { insertPathAnchorAction } from 'interactions/actions/defaults/insertPathAnchor';
import { exitPathEditToolAction } from 'interactions/actions/defaults/pathEditTools';
import {
  pathfinderCropAction, pathfinderDivideAction, pathfinderExcludeAction, pathfinderIntersectAction,
  pathfinderMergeAction, pathfinderSubtractAction, pathfinderTrimAction, pathfinderUnionAction,
} from 'interactions/actions/booleans/action';
import { makeBooleanGroupAction } from 'interactions/actions/booleans/booleanGroupAction';
import { createOutlinesAction } from 'interactions/actions/outlines/createOutlinesAction';
import { outlineStrokeAction } from 'interactions/actions/outlines/outlineStrokeAction';
import {
  joinPathsAction, offsetPathAction, simplifyPathAction, snipAtCrossingsAction,
} from 'interactions/actions/pathCommands';
import type { FeaturePreset } from '../features';

/**
 * The path-edit keys that share a key with a node-level action: anchor nudging
 * and deleting, and Escape out of path edit or its tool. Each is tried ahead of
 * its twin, which is enabled whenever anything is selected.
 */
export const anchorKeysPreset: FeaturePreset = {
  id: 'anchorKeys',
  label: 'Anchor keys',
  refines: ['nudge', 'delete', 'escape'],
  actions: [
    nudgeAnchorsUpAction, nudgeAnchorsDownAction, nudgeAnchorsLeftAction, nudgeAnchorsRightAction,
    deleteAnchorsAction, exitPathEditAction, exitPathEditToolAction,
  ],
};

/** The pathfinder booleans, and the live boolean group. */
export const pathfinderPreset: FeaturePreset = {
  id: 'pathfinder',
  label: 'Pathfinder',
  actions: [
    pathfinderUnionAction, pathfinderSubtractAction, pathfinderIntersectAction, pathfinderExcludeAction,
    pathfinderDivideAction, pathfinderCropAction, pathfinderTrimAction, pathfinderMergeAction,
    makeBooleanGroupAction,
  ],
};

/** Text and strokes to paths. */
export const outlinesPreset: FeaturePreset = {
  id: 'outlines', label: 'Outlines', actions: [createOutlinesAction, outlineStrokeAction],
};

/** Entering path edit, and editing anchors, handles, and segments in it. */
export const pathEditPreset: FeaturePreset = {
  id: 'pathEdit',
  label: 'Path edit',
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

/** Pathfinder operations, path-edit entry, and anchor editing. */
export const pathsPreset: FeaturePreset = {
  id: 'paths',
  label: 'Paths',
  includes: [anchorKeysPreset, pathfinderPreset, outlinesPreset, pathEditPreset, pathCommandsPreset],
};
