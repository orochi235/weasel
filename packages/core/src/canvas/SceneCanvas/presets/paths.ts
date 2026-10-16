import {
  cutPathAtAnchorAction, deleteAnchorsAction, marqueeAnchorsAction,
  nudgeAnchorsDownAction, nudgeAnchorsLeftAction, nudgeAnchorsRightAction, nudgeAnchorsUpAction,
  selectAnchorAction,
} from 'interactions/actions/defaults/anchorEditing';
import { constrainAnchorsAction, deleteConstraintAction, unconstrainAnchorsAction } from 'interactions/actions/defaults/anchorConstraints';
import { harmonizeAnchorsAction, makeHandlesSymmetricAction, retractHandlesAction } from 'interactions/actions/defaults/anchorHandles';
import { averageAnchorsAction, bridgeAnchorsAction, joinAnchorsAction } from 'interactions/actions/defaults/anchorJoin';
import { bendSegmentAction } from 'interactions/actions/defaults/bendSegment';
import { enterPathEditAction } from 'interactions/actions/defaults/enterPathEdit';
import { exitPathEditAction } from 'interactions/actions/defaults/exitPathEdit';
import { editAnchorsAction } from 'interactions/actions/edit-anchors/action';
import { balanceHandlesAction, equalizeHandlesAction } from 'interactions/actions/defaults/handleBalance';
import { handleLockAngleAction, handleLockLengthAction } from 'interactions/actions/defaults/handleLocks';
import { insertPathAnchorAction } from 'interactions/actions/defaults/insertPathAnchor';
import { exitPathEditToolAction } from 'interactions/actions/defaults/pathEditTools';
import { simplifyBrushAction, simplifyBrushToolAction } from 'interactions/actions/defaults/simplifyBrush';
import {
  pathfinderCropAction, pathfinderDivideAction, pathfinderExcludeAction, pathfinderIntersectAction,
  pathfinderMergeAction, pathfinderSubtractAction, pathfinderTrimAction, pathfinderUnionAction,
} from 'interactions/actions/booleans/action';
import { createOutlinesAction } from 'interactions/actions/outlines/createOutlinesAction';
import { outlineStrokeAction } from 'interactions/actions/outlines/outlineStrokeAction';
import {
  bridgePathsAction, extendToMeetAction, joinPathsAction, offsetPathAction, simplifyPathAction, smudgeBrushAction,
  snipAtCrossingsAction, trimPathAction,
} from 'interactions/actions/pathCommands';
import {
  bendAlongAction, blendAction, editPathEffectAction, expandPathEffectAction, repeatAlongAction,
} from 'interactions/actions/pathEffects';
import { configureWarpAction, expandWarpAction } from 'interactions/actions/warp/warpActions';
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
    deleteAnchorsAction, deleteConstraintAction,
    pathfinderUnionAction, pathfinderSubtractAction, pathfinderIntersectAction, pathfinderExcludeAction,
    pathfinderDivideAction, pathfinderCropAction, pathfinderTrimAction, pathfinderMergeAction,
    createOutlinesAction, outlineStrokeAction,
    editAnchorsAction,
    // Ahead of enterPathEdit: a balance grip inside the path's body ties its
    // double-click on specificity.
    equalizeHandlesAction,
    enterPathEditAction, exitPathEditAction, insertPathAnchorAction, bendSegmentAction,
    balanceHandlesAction, cutPathAtAnchorAction,
    simplifyBrushAction, simplifyBrushToolAction, exitPathEditToolAction,
    retractHandlesAction, makeHandlesSymmetricAction, harmonizeAnchorsAction,
    handleLockAngleAction, handleLockLengthAction,
    constrainAnchorsAction, unconstrainAnchorsAction,
    averageAnchorsAction, joinAnchorsAction, bridgeAnchorsAction,
    simplifyPathAction, offsetPathAction, snipAtCrossingsAction, joinPathsAction, bridgePathsAction,
    trimPathAction, extendToMeetAction, smudgeBrushAction,
    blendAction, bendAlongAction, repeatAlongAction, editPathEffectAction, expandPathEffectAction,
    expandWarpAction, configureWarpAction,
    marqueeAnchorsAction, selectAnchorAction,
  ],
};
