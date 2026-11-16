/**
 * @weasel-js/editing — editing for a weasel canvas, as presets an app opts
 * into. `@weasel-js/core` draws, pans and zooms a scene; the presets here add
 * selecting and acting on what is selected: moving, resizing and rotating,
 * the edit, arrange and Pathfinder commands, and paste and drop.
 *
 * @packageDocumentation
 */
import type {} from './actionParamSchema';

export type { AlignParams, DistributeParams, FlipParams, ReorderParams } from './actionParamSchema';

export { selectPreset } from './presets/select';
export { movePreset, outlinePreset, resizePreset, rotatePreset } from './presets/transform';
export {
  clipboardPreset, contextMenuPreset, deletePreset, duplicatePreset, editPreset, escapePreset, groupPreset,
  nudgePreset, selectAllPreset, stylePreset,
} from './presets/edit';
export { alignPreset, arrangePreset, distributePreset, flipPreset, reorderPreset } from './presets/arrange';
export { pathfinderPreset } from './presets/pathfinder';
export { selectToolsPreset, shapeToolsPreset } from './presets/tools';
export { drawPreset, pickPreset, transformPreset } from './presets/composites';
export { ingestPreset } from './presets/ingest';
export {
  FEATURE_ACTION_IDS, FEATURE_NAMES, FEATURE_PRESETS, KIT_STANDARD_ACTIONS, namedFeatures, type FeatureName,
} from './namedPresets';
export {
  useStandardActions, KIT_STANDARD_ACTION_IDS, type UseStandardActionsOptions,
} from './useStandardActions';

export { flipAction } from './actions/flip/action';
export type { FlipAxis, FlipPivot } from './actions/flip/helpers';
export { reorderForwardAction, reorderBackwardAction } from './actions/reorder/reorder';
export {
  alignLeftAction, alignRightAction, alignTopAction, alignBottomAction, alignCenterXAction, alignCenterYAction,
} from './actions/align/action';
export { useAlign, alignDeltaFor, alignTargetBounds } from './actions/align';
export type { AlignAdapter, AlignEdge, AlignReference, UseAlignOptions, UseAlignReturn } from './actions/align';
export { distributeHorizontalAction, distributeVerticalAction } from './actions/distribute/action';
export { useDistribute } from './actions/distribute';
export type {
  DistributeAdapter, DistributeAxis, DistributeMode, UseDistributeOptions, UseDistributeReturn,
} from './actions/distribute';

export { ENGINE_STANDARD_ACTIONS } from './engineStandardActions';
export { escapeAction } from './actions/edit/escape';
export { selectAllAction } from './actions/edit/selectAll';
export { duplicateAction, duplicateSelection } from './actions/edit/duplicate';
export { groupAction, ungroupAction } from './actions/edit/group';
export { nudgeUpAction, nudgeDownAction, nudgeLeftAction, nudgeRightAction } from './actions/edit/nudge';
export { setFillAction } from './actions/edit/setFill';
export { setFillOpacityAction } from './actions/edit/setFillOpacity';
export { setStrokeAction } from './actions/edit/setStroke';
export { setStrokeOpacityAction } from './actions/edit/setStrokeOpacity';
export { setStrokeWidthAction } from './actions/edit/setStrokeWidth';
export { setVertexColorAction } from './actions/edit/setVertexColor';
export { ingestAction } from './actions/edit/ingest';
export { transformAgainAction } from './actions/transformAgain/action';
export { transformSelection, type SelectionTransform } from './actions/transformAgain/transformSelection';
export { clipboardCopyAction, clipboardCutAction, clipboardPasteAction, clipboardPasteEventAction } from './actions/clipboard/action';
export {
  PATHFINDER_STROKES, pathfinderUnionAction, pathfinderSubtractAction, pathfinderIntersectAction,
  pathfinderExcludeAction, pathfinderDivideAction, pathfinderCropAction, pathfinderTrimAction, pathfinderMergeAction,
} from './actions/pathfinder/action';
export { booleanGroupOps, makeBooleanGroup, makeBooleanGroupAction } from './actions/pathfinder/booleanGroupAction';
export { PATHFINDER_KEYMAP, PATHFINDER_KEYMAP_ID, PATHFINDER_LEADER } from './actions/pathfinder/keymap';
