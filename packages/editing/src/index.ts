/**
 * @weasel-js/editing — editing for a weasel canvas, as presets an app opts
 * into. `@weasel-js/core` draws, pans and zooms a scene; the presets here add
 * selecting and acting on what is selected: moving, resizing and rotating,
 * the edit, arrange and Pathfinder commands, and paste and drop.
 *
 * @packageDocumentation
 */
import type {} from './actionParamSchema';

export type { EditingIconName } from './icons.gen';

export type { AlignParams, DistributeParams, FlipParams, ReorderParams } from './actionParamSchema';

export { selectPreset } from './presets/select';
export { selectionPreset } from './presets/selection';
export { movePreset, outlinePreset, resizePreset, rotatePreset } from './presets/transform';
export {
  clipboardPreset, contextMenuPreset, deletePreset, duplicatePreset, editPreset, escapePreset, groupPreset,
  nudgePreset, selectAllPreset, stylePreset,
} from './presets/edit';
export { alignPreset, arrangePreset, distributePreset, flipPreset, reorderPreset } from './presets/arrange';
export { pathfinderPreset } from './presets/pathfinder';
export { booleansPreset } from './presets/booleans';
export { selectToolsOfferedPreset, selectToolsPreset, shapeToolsOfferedPreset, shapeToolsPreset } from './presets/tools';
import type {} from './tools/toolOptions';
export {
  KIT_TOOL_GROUPS, KIT_TOOL_IDS, KIT_TOOLS, SELECT_TOOLS, SHAPE_TOOLS, TOOL_GROUP_ORDER, type KitToolId,
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
export {
  createSelectTool, createPickerSelectTool, useSelectTool, usePickerSelectTool, type SelectAdapter, type UseSelectToolOptions,
} from './tools/select/useSelectTool';
export {
  createSelectionMoveContribution, selectionMoveBindings, createSelectionTransformContribution, selectionTransformBindings,
  createSelectionResizeContribution, selectionResizeBindings, createSelectionRotateContribution, selectionRotateBindings,
  createAreaSelectContribution, isBodyOffChrome, isEmptyOffChrome, AREA_SELECT_ID, SELECTION_MOVE_ID, SELECTION_TRANSFORM_ID,
  SELECTION_RESIZE_ID, SELECTION_ROTATE_ID, type SelectionMoveOptions, type SelectionTransformOptions,
  type SelectionRotateOptions,
} from './tools/select/selectionContributions';
export {
  createGroupEntryContribution, useGroupEntryContribution, GROUP_ENTRY_ID, GROUP_LEAVE_PRESS_BINDING,
} from './tools/select/groupEntry';
export {
  commitDeleteToScene, createDeleteAction, deleteAction, hiddenSourceDeleteOps, type DeleteActionOptions,
} from './actions/delete/delete';
export {
  createEnterGroupAction, createLeaveGroupAction, type EnterGroupOptions, type LeaveGroupOptions,
} from './actions/group/enterGroup';
export { drawPreset, pickPreset, transformPreset } from './presets/composites';
export { ingestPreset } from './presets/ingest';
export { KIT_CONTENT_HANDLERS } from './ingest/kitHandlers';
export { insertPreset } from './presets/insert';
export { selectionChromePreset } from './presets/selectionChrome';
export { SELECTION_CHROME } from './chrome/selectionChrome';
export {
  composeSelectionPose, createSelectionHandlesLayer, createSelectionOutlineLayer, createSelectionOverlayLayer,
  type ComposeSelectionPoseOptions,
} from './chrome/overlay';
export {
  createCornerResizeAffordance, type CornerResizeAffordanceOptions, type CornerResizeScratch,
} from './chrome/affordances/cornerResize';
export {
  createRotationAffordance, type RotationAffordanceOptions, type RotationScratch,
} from './chrome/affordances/rotationHandle';
export {
  rotationHandle, hitRotationHandle, DEFAULT_ROTATION_HANDLE_DISTANCE, type RotationHandle,
} from './chrome/rotationHandleGeometry';
export {
  FEATURE_ACTION_IDS, FEATURE_NAMES, FEATURE_PRESETS, KIT_STANDARD_ACTIONS, namedFeatures, type FeatureName,
} from './namedPresets';
export {
  useStandardActions, KIT_STANDARD_ACTION_IDS, type UseStandardActionsOptions,
} from './useStandardActions';

export { moveAction } from './actions/move/action';
export { snapToContainer, snapBackOrDelete, clampMove, type ClampMoveOptions } from './actions/move/behaviors';
export { cloneAction } from './actions/clone/action';
export { createResizeAction, resizeAction, type ResizeActionOptions } from './actions/resize/action';
export { clampMinSize } from './actions/resize/behaviors';
export { useResizePolicyDepSource, resizePolicyOptions, type UseResizePolicyDepSourceOptions } from './deps/resizePolicy';
export { rotateAction } from './actions/rotate/action';
export { areaSelectAction } from './actions/select/areaSelect';
export { clearSelectionAction } from './actions/select/clearSelection';
export { lassoSelectAction } from './actions/lassoSelect/action';
export type { UseLassoSelectOptions } from './actions/lassoSelect/options';
export { selectFromLasso, type SelectFromLassoOptions } from './actions/lassoSelect/behaviors/selectFromLasso';
export { insertAction, INSERT_DRAG_MODS } from './actions/insert/action';
export { insertParams, POLYGON_INSERT_PARAMS, STAR_INSERT_PARAMS } from './actions/insert/params';
export { placeAction } from './actions/insert/placeAction';
export { insertRepositionAction, INSERT_REPOSITION_BINDING } from './actions/insert/repositionAction';
export { insertRotateAction } from './actions/insert/rotateAction';
export {
  DEFAULT_STROKE_WIDTH, insertStyleOf, STYLE_OPTION_KEYS, type InsertStyle, type StyleOptionKey,
} from './actions/insert/style';
export { KIT_INSERT_KINDS, useInsertDepSource } from './deps/insert';

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
export { createSelection, useSelection, type UseSelectionOptions } from './selection/useSelection';
export { deselectAction } from './actions/edit/deselect';
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
export { clipboardCopyAction, clipboardCutAction, clipboardPasteAction, clipboardPasteCopiedAction } from './actions/clipboard/action';
export {
  PATHFINDER_STROKES, pathfinderUnionAction, pathfinderSubtractAction, pathfinderIntersectAction,
  pathfinderExcludeAction, pathfinderDivideAction, pathfinderCropAction, pathfinderTrimAction, pathfinderMergeAction,
} from './actions/pathfinder/action';
export { booleanGroupOps, makeBooleanGroup, makeBooleanGroupAction } from './actions/pathfinder/booleanGroupAction';
export { PATHFINDER_KEYMAP, PATHFINDER_KEYMAP_ID, PATHFINDER_LEADER } from './actions/pathfinder/keymap';
export {
  useBooleans, useBooleansAdapter, applyBooleanOp, previewBooleanOp, resolveBooleanOperands, commitBooleanPieces,
  type BooleanOp, type BooleansAdapter, type BooleanOpPreview, type BooleanOpResult, type BooleanPreviewPiece,
  type BooleanOpOptions, type BooleanStrokes, type BooleanSource, type BooleanOperands, type BooleanCommitPiece,
  type UseBooleansOptions, type UseBooleansReturn,
} from './booleans';
export { useBooleansAdapterDepSource } from './deps/booleans';
export {
  useClipboard, useClipboardOps, WEASEL_CLIPBOARD_MIME, WEASEL_CLIPBOARD_MIME_WEB, buildWeaselClipboardText,
  sniffWeaselClipboardText, parseWeaselClipboardText, embedWeaselMetadataInSvg, extractWeaselClipboardFromSvg,
  type ClipboardFlavors, type PastedItems, type UseClipboardOptions, type UseClipboardOpsOptions,
  type UseClipboardOpsReturn,
} from './clipboard';
