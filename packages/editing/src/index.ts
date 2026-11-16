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
export { selectToolKitPreset, selectToolsPreset, shapeToolKitPreset, shapeToolsPreset } from './presets/tools';
import type {} from './tools/toolOptions';
export {
  BUILTIN_TOOL_GROUPS, BUILTIN_TOOL_IDS, BUILTIN_TOOLS, SELECT_TOOLS, SHAPE_TOOLS, TOOL_GROUP_ORDER, type KitToolId,
} from './tools/toolSets';
export {
  DEFAULT_SHAPE_PAINT, shapeToolOptions, styleOptionLeaves, toolOptionPaint, type ShapeToolOptionsSpec,
} from './tools/shared/styleOptions';
export { insertBindingBehaviors, type InsertToolOptions } from './tools/shared/insertToolOptions';
export { createPointerFollower, type PointerFollower } from './tools/shared/pointerFollower';
export { createRectTool, useRectTool, RECT_TOOL_OPTIONS } from './tools/rect';
export { createEllipseTool, useEllipseTool, ELLIPSE_TOOL_OPTIONS } from './tools/ellipse';
export { createLineTool, useLineTool, LINE_TOOL_OPTIONS, type LinePoint } from './tools/line';
export {
  createPolygonTool, usePolygonTool, POLYGON_TOOL_OPTIONS, type CreatePolygonToolOptions, type PolygonPoint,
  type UsePolygonToolOptions,
} from './tools/polygon';
export {
  createStarTool, useStarTool, STAR_TOOL_OPTIONS, type CreateStarToolOptions, type StarPoint, type UseStarToolOptions,
} from './tools/star';
export { createLassoTool, useLassoTool, LASSO_TOOL_OPTIONS, type UseLassoToolOptions } from './tools/lasso';
export { useImageTool, type UseImageToolOptions } from './tools/image';
export { useEyedropperTool, type UseEyedropperToolOptions } from './tools/eyedropper';
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
