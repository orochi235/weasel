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
