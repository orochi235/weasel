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
  filletPreset,
  createBalancePreset,
  createConstraintsPreset,
  createFilletPreset,
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
  sandPreset,
  kneadPreset,
  snipPreset,
  warpPreset,
} from './presets';
export type { ActionParamSchema } from './actionParamSchema';

// ─── Actions ───────────────────────────────────────────────────────────────
export {
  SAND_PARAMS, SAND_RADIUS_PX, sandAction, type SandParams,
} from './sand/sand';
export { SAND_TOOL_OPTIONS, useSandTool, type UseSandToolOptions } from './sand/useSandTool';
export { handleLockAngleAction, handleLockLengthAction } from './handleLocks/handleLocks';
export {
  BRIDGE_PARAMS, bridgeAnchorsAction, bridgePathsAction, bridgeTensionOf, DEFAULT_BRIDGE_TENSION,
} from './bridge/bridge';
export { planSnip, SNIP_PATH_PARAMS, snipPathAction } from './snip/snip';
export { EXTEND_TO_MEET_PARAMS, extendToMeetAction, type ExtendToMeetParams } from './extend/extendToMeet';
export { LENGTHEN_PATH_PARAMS, lengthenPathAction, type LengthenPathParams } from './lengthen/lengthenPath';
export { useLengthenTool } from './lengthen/useLengthenTool';
export {
  overlayShown, PATH_OVERLAYS_GROUP, showBalanceAction, showCombAction, showFilletsAction, showDirectionAction,
  showOverlayAction,
} from './overlays/showOverlay';
export {
  DEFAULT_KNEAD_RADIUS_PX, DEFAULT_KNEAD_STRENGTH, KNEAD_PARAMS, kneadAction, type KneadParams,
} from './knead/knead';
export { harmonizeAnchorsAction } from './harmonize/harmonize';
export { reversePathAction, setPathStartAction } from './pathStructure/pathStructure';
export { convertSegmentAtAction, convertSegmentsAction } from './segmentType/convertSegments';
export {
  ANCHOR_SELECTION_GROUP, growAnchorSelectionAction, invertAnchorSelectionAction, SELECT_EVERY_NTH_ANCHOR_PARAMS, selectCornerAnchorsAction,
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
export { PATH_EFFECT_PARAMS } from './pathEffects/effectForms';
export {
  FILLET_SHAPE_OPTIONS, DEFAULT_FILLET_SHAPE, EDIT_FILLET_PARAMS, editFilletAction, type EditFilletParams,
} from './fillet/editFillet';
export {
  CYCLE_FILLET_PARAMS, cycleFilletAction, DEFAULT_FILLET_TRIM_SHARE, setFilletsAction, type CycleFilletParams,
} from './fillet/filletCommands';

// ─── Tools ─────────────────────────────────────────────────────────────────
export { useSnipTool, type UseSnipToolOptions } from './snip/useSnipTool';
export { useExtendTool, type UseExtendToolOptions } from './extend/useExtendTool';
export { KNEAD_TOOL_OPTIONS, useKneadTool, type UseKneadToolOptions } from './knead/useKneadTool';
export type { StrokeClickToolOptions } from './shared/strokeClickTool';
export {
  useDistortTool, useClothWarpTool, usePuppetTool,
  type UseDistortToolOptions, type UseClothWarpToolOptions, type UsePuppetToolOptions, type WarpTool, type WarpToolOptions,
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
  FILLET_WIDGET_STANDOFF_PX, filletWidgetCommands, filletWidgetFrames, createFilletWidgetsExtension,
  PATH_FILLETS_CHROME_ID, type FilletWidgetStyle,
} from './fillet/filletWidgets';
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
  FILLET_CONTROLS, FILLET_CONTROLS_PROMPT, FILLET_K_SLIDER_RANGE, filletControlsParams, filletControlsState, type FilletControlsState,
} from './fillet/filletControls';
export {
  useFilletControls, type FilletControlsScene, type FilletControlsSelection, type UseFilletControlsReturn,
} from './fillet/useFilletControls';

// ─── Data the tools keep on a node ─────────────────────────────────────────
export { constraintAxisOf, constraintConflictsOf, constraintsOf } from './constraints/pathConstraints';
export {
  heldPathWarpOf, resolvePathWarp, withoutPathWarp, type HeldPathWarp, type ResolvedPathWarp,
} from './warp/pathWarp';
export {
  DEFAULT_CLOTH_SIZE, DEFAULT_WARP_TOLERANCE, withPathWarp, type WarpKind, type WarpSettings,
} from './warp/warpTargets';

// Carries path-tools' IconName augmentation into the published declarations.
export type { PathToolsIconName } from './icons.gen';

export {
  WARP_TOOLS, RESHAPE_TOOLS, PATH_EDIT_TOOLS, PATH_TOOLS_TOOLS, usePathEditTools, usePathToolsTools,
  type PathEditToolId, type PathToolId,
} from './toolSets';
