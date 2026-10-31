/**
 * `@weasel-js/path-tools` — path-editing tools for a weasel canvas, each
 * family a `FeaturePreset` an app turns on beside core's: `features={['draw',
 * pathTools]}` for all of them, or one at a time.
 *
 * @packageDocumentation
 */
// Brings the `ActionParamSchema` entries for this package's actions into the
// declarations; `import type` so the bundle carries nothing for it.
import type {} from './actionParamSchema';

export {
  addExtremesPreset,
  anchorSelectionPreset,
  balancePreset,
  bridgePreset,
  constraintsPreset,
  cornerShapePreset,
  createBalancePreset,
  createConstraintsPreset,
  createCornerShapePreset,
  createCurvatureCombPreset,
  createHandleSnapPreset,
  createPathStructurePreset,
  createSoftSelectionPreset,
  curvatureCombPreset,
  extendPreset,
  handleLocksPreset,
  handleSnapPreset,
  lengthenPreset,
  harmonizePreset,
  pathEffectsPreset,
  pathStructurePreset,
  pathTools,
  segmentTypePreset,
  resamplePreset,
  simplifyBrushPreset,
  smudgePreset,
  trimPreset,
  warpPreset,
} from './presets';
export type { ActionParamSchema } from './actionParamSchema';

// ─── Actions ───────────────────────────────────────────────────────────────
export {
  brushRingCursor, SIMPLIFY_BRUSH_PARAMS, SIMPLIFY_BRUSH_RADIUS_PX, simplifyBrushAction, type SimplifyBrushParams,
} from './simplifyBrush/simplifyBrush';
export { SIMPLIFY_BRUSH_OPTIONS, useSimplifyBrushTool } from './simplifyBrush/useSimplifyBrushTool';
export { handleLockAngleAction, handleLockLengthAction } from './handleLocks/handleLocks';
export {
  BRIDGE_PARAMS, bridgeAnchorsAction, bridgePathsAction, bridgeTensionOf, DEFAULT_BRIDGE_TENSION,
} from './bridge/bridge';
export { planTrim, TRIM_PATH_PARAMS, trimPathAction } from './trim/trimSegment';
export { EXTEND_TO_MEET_PARAMS, extendToMeetAction, type ExtendToMeetParams } from './extend/extendToMeet';
export { LENGTHEN_PATH_PARAMS, lengthenPathAction, type LengthenPathParams } from './lengthen/lengthenPath';
export { useLengthenTool } from './lengthen/useLengthenTool';
export {
  overlayShown, PATH_OVERLAYS_GROUP, showBalanceAction, showCombAction, showCornersAction, showDirectionAction,
  showOverlayAction,
} from './overlays/showOverlay';
export {
  DEFAULT_SMUDGE_RADIUS_PX, DEFAULT_SMUDGE_STRENGTH, SMUDGE_BRUSH_PARAMS, smudgeBrushAction, type SmudgeBrushParams,
} from './smudge/smudgeBrush';
export { harmonizeAnchorsAction } from './harmonize/harmonize';
export { reversePathAction, setPathStartAction } from './pathStructure/pathStructure';
export { convertSegmentAtAction, convertSegmentsAction } from './segmentType/convertSegments';
export {
  ANCHOR_SELECTION_GROUP, growAnchorSelectionAction, invertAnchorSelectionAction, selectCornerAnchorsAction,
  selectEveryNthAnchorAction, selectSmoothAnchorsAction, shrinkAnchorSelectionAction,
} from './anchorSelect/anchorSelect';
export { RESAMPLE_PARAMS, resamplePathAction, type ResamplePathParams } from './resample/resample';
export { ADD_EXTREMES_PARAMS, addExtremeAnchorsAction, type AddExtremesParams } from './extremes/addExtremes';
export { balanceHandlesAction, equalizeHandlesAction } from './balance/handleBalance';
export {
  CONSTRAINT_KIND_LABELS, constrainAnchorsAction, constraintsForAnchors, deleteConstraintAction, unconstrainAnchorsAction,
  type ConstrainAnchorsParams,
} from './constraints/anchorConstraints';
export {
  bendAlongAction, blendAction, editPathEffectAction, expandPathEffectAction, puckerBloatAction, repeatAlongAction,
  roughenAction, textAlongAction, zigzagAction,
  PATH_EFFECTS_GROUP,
} from './pathEffects/actions';
export { releasePathEffectAction, setEffectPathAction } from './pathEffects/retarget';
export { releaseBlendSpineAction, setBlendSpineAction } from './pathEffects/spine';
export {
  configureWarpAction, expandWarpAction, warpHandleScratchOf, type WarpHandleScratch,
} from './warp/warpActions';
export { WARP_SETTINGS_SCHEMA, warpSettingsForm } from './warp/warpSettingsForm';
export { configureWarpParams, settingsOfWarp, WARP_SETTING_FIELDS, warpDragParams } from './warp/warpParams';
export { PATH_EFFECT_SETTINGS_SCHEMA, pathEffectSettingsForm } from './pathEffects/settingsForm';
export {
  CORNER_SHAPE_OPTIONS, DEFAULT_CORNER_SHAPE, EDIT_CORNER_PARAMS, editCornerAction, type EditCornerParams,
} from './cornerShape/editCorner';
export {
  CYCLE_CORNER_SHAPE_PARAMS, cycleCornerShapeAction, DEFAULT_CORNER_TRIM_SHARE, setCornersAction, type CycleCornerShapeParams,
} from './cornerShape/cornerCommands';

// ─── Tools ─────────────────────────────────────────────────────────────────
export { useTrimTool, type UseTrimToolOptions } from './trim/useTrimTool';
export { useExtendTool, type UseExtendToolOptions } from './extend/useExtendTool';
export { SMUDGE_BRUSH_OPTIONS, useSmudgeBrushTool, type UseSmudgeBrushToolOptions } from './smudge/useSmudgeBrushTool';
export type { StrokeClickToolOptions } from './shared/strokeClickTool';
export {
  useDistortTool, useEnvelopeTool, usePuppetTool,
  type UseDistortToolOptions, type UseEnvelopeToolOptions, type UsePuppetToolOptions, type WarpTool, type WarpToolOptions,
} from './warp/useWarpTool';
export { warpLayerId } from './warp/warpHandles';
export {
  facesAlong, planShapeBuilder, useShapeBuilderTool,
  type ShapeBuilderFace, type ShapeBuilderMode, type ShapeBuilderPlan, type UseShapeBuilderToolOptions,
} from './shapeBuilder';
export {
  useGirthTool, createGirthOverlay, createGirthActions, DEFAULT_GIRTH_REACH_PX, GIRTH_CLEAR_ID, GIRTH_DRAG_ID,
  GIRTH_DRAG_PARAMS, GIRTH_HOVER_ID, GIRTH_UNHOVER_ID, type GirthDragParams, type UseGirthToolOptions, type WidthEdgeHit, type GirthEnv, type GirthFocus, type WidthGrip, type WidthTarget,
} from './girth';

// ─── Spiro curves ──────────────────────────────────────────────────────────
export * from './spiro';

// ─── Path-edit chrome ──────────────────────────────────────────────────────
export { combCommands, createCombExtension, PATH_COMB_CHROME_ID, type PathEditCombOptions } from './comb/comb';
export {
  balanceCommands, createBalanceExtension, PATH_BALANCE_CHROME_ID, type PathEditBalanceStyle,
} from './balance/balanceMarks';
export {
  CONSTRAINTS_EXTENSION_ID, createConstraintsExtension, DEFAULT_CONSTRAINT_STYLE, selectedConstraintOf, setConstraints,
} from './constraints/constraintsExtension';
export {
  brokenConstraintLink, brokenConstraintLinks, constraintLinkConflictsOf, constraintLinkNode, constraintLinkOf,
  type BrokenConstraintLink, type ConstraintLinkData, type ConstraintLinkNodeOptions,
} from './constraints/constraintLinks';
export {
  LINK_ANCHOR_PARAMS, linkAnchorAction, linkConstraint, linkTargetAt, type LinkAnchorParams, type LinkTarget,
} from './constraints/linkAnchor';
export {
  CONSTRAINT_LINK_MARKS_ID, constraintLinkMarks, createConstraintLinkMarks,
} from './constraints/constraintLinkMarks';
export type { ConstraintGlyphStyle } from './constraints/constraintGlyphs';
export {
  CORNER_WIDGET_STANDOFF_PX, cornerWidgetCommands, cornerWidgetFrames, createCornerWidgetsExtension,
  PATH_CORNERS_CHROME_ID, type CornerWidgetStyle,
} from './cornerShape/cornerWidgets';
export {
  createDirectionExtension, directionCommands, PATH_DIRECTION_CHROME_ID, type PathDirectionStyle,
} from './pathStructure/directionMarks';

// ─── Path-edit drags ───────────────────────────────────────────────────────
export {
  createHandleSnapExtension, handleSnapSource, type HandleSnapOptions, type HandleSnapOptionsInput,
} from './handleSnap/handleSnap';
export { createSoftSelectionExtension, type SoftSelectionOptions } from './softSelection/softSelection';

// ─── Panels ────────────────────────────────────────────────────────────────
export {
  CORNER_CONTROLS, CORNER_CONTROLS_PROMPT, CORNER_K_SLIDER_RANGE, cornerControlsParams, cornerControlsState, type CornerControlsState,
} from './cornerShape/cornerControls';
export {
  useCornerControls, type CornerControlsScene, type CornerControlsSelection, type UseCornerControlsReturn,
} from './cornerShape/useCornerControls';

// ─── Data the tools keep on a node ─────────────────────────────────────────
export { constraintAxisOf, constraintConflictsOf, constraintsOf } from './constraints/pathConstraints';
export {
  heldPathWarpOf, resolvePathWarp, withoutPathWarp, type HeldPathWarp, type ResolvedPathWarp,
} from './warp/pathWarp';
export {
  DEFAULT_ENVELOPE_SIZE, DEFAULT_WARP_TOLERANCE, withPathWarp, type WarpKind, type WarpSettings,
} from './warp/warpTargets';

// Carries path-tools' IconName augmentation into the published declarations.
export type { PathToolsIconName } from './icons.gen';

export {
  WARP_TOOLS, RESHAPE_TOOLS, PATH_EDIT_TOOLS, PATH_TOOLS_TOOLS, usePathEditTools, usePathToolsTools,
  type PathEditToolId, type PathToolId,
} from './toolSets';
