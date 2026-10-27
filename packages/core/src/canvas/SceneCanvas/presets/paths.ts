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
 * Pathfinder operations, path-edit entry, and anchor editing.
 *
 * It refines `edit`: anchor nudging and deleting are tried ahead of their
 * node-level twins, which bind the same keys and are enabled whenever
 * anything is selected.
 */
export const pathsPreset: FeaturePreset = {
  id: 'paths',
  refines: ['edit'],
  actions: [
    nudgeAnchorsUpAction, nudgeAnchorsDownAction, nudgeAnchorsLeftAction, nudgeAnchorsRightAction,
    deleteAnchorsAction,
    pathfinderUnionAction, pathfinderSubtractAction, pathfinderIntersectAction, pathfinderExcludeAction,
    pathfinderDivideAction, pathfinderCropAction, pathfinderTrimAction, pathfinderMergeAction,
    makeBooleanGroupAction,
    createOutlinesAction, outlineStrokeAction,
    editAnchorsAction,
    enterPathEditAction, exitPathEditAction, insertPathAnchorAction, bendSegmentAction,
    cutPathAtAnchorAction, exitPathEditToolAction,
    retractHandlesAction, makeHandlesSymmetricAction,
    averageAnchorsAction, joinAnchorsAction, setAnchorFieldAction,
    simplifyPathAction, offsetPathAction, snipAtCrossingsAction, joinPathsAction,
    marqueeAnchorsAction, selectAnchorAction,
  ],
};
