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
  createPathStructurePreset,
  curvatureCombPreset,
  extendPreset,
  handleLocksPreset,
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
  brushRingCursor, SIMPLIFY_BRUSH_RADIUS_PX, SIMPLIFY_BRUSH_TOOL, simplifyBrushAction, simplifyBrushToolAction,
  type SimplifyBrushParams,
} from './simplifyBrush/simplifyBrush';
export { handleLockAngleAction, handleLockLengthAction } from './handleLocks/handleLocks';
export {
  bridgeAnchorsAction, bridgePathsAction, bridgeTensionOf, DEFAULT_BRIDGE_TENSION,
} from './bridge/bridge';
export { planTrim, trimPathAction } from './trim/trimSegment';
export { extendToMeetAction } from './extend/extendToMeet';
export {
  DEFAULT_SMUDGE_RADIUS_PX, DEFAULT_SMUDGE_STRENGTH, smudgeBrushAction, type SmudgeBrushParams,
} from './smudge/smudgeBrush';
export { harmonizeAnchorsAction } from './harmonize/harmonize';
export { reversePathAction, setPathStartAction } from './pathStructure/pathStructure';
export { convertSegmentAtAction, convertSegmentsAction } from './segmentType/convertSegments';
export {
  ANCHOR_SELECTION_GROUP, growAnchorSelectionAction, invertAnchorSelectionAction, selectCornerAnchorsAction,
  selectEveryNthAnchorAction, selectSmoothAnchorsAction, shrinkAnchorSelectionAction,
} from './anchorSelect/anchorSelect';
export { resamplePathAction, type ResamplePathParams } from './resample/resample';
export { addExtremeAnchorsAction } from './extremes/addExtremes';
export { balanceHandlesAction, equalizeHandlesAction } from './balance/handleBalance';
export {
  constrainAnchorsAction, constraintsForAnchors, deleteConstraintAction, unconstrainAnchorsAction,
  type ConstrainAnchorsParams,
} from './constraints/anchorConstraints';
export {
  bendAlongAction, blendAction, editPathEffectAction, expandPathEffectAction, repeatAlongAction,
  PATH_EFFECTS_GROUP,
} from './pathEffects/actions';
export {
  configureWarpAction, expandWarpAction, warpHandleScratchOf, type WarpHandleScratch,
} from './warp/warpActions';
export { DEFAULT_CORNER_SHAPE, editCornerAction } from './cornerShape/editCorner';
export { cycleCornerShapeAction, DEFAULT_CORNER_TRIM_SHARE, setCornersAction } from './cornerShape/cornerCommands';

// ─── Tools ─────────────────────────────────────────────────────────────────
export { useTrimTool, type UseTrimToolOptions } from './trim/useTrimTool';
export { useExtendTool, type UseExtendToolOptions } from './extend/useExtendTool';
export { useSmudgeBrushTool, type UseSmudgeBrushToolOptions } from './smudge/useSmudgeBrushTool';
export type { StrokeClickToolOptions } from './shared/strokeClickTool';
export {
  useDistortTool, useEnvelopeTool, usePuppetTool,
  type UseDistortToolOptions, type UseEnvelopeToolOptions, type UsePuppetToolOptions, type WarpTool,
} from './warp/useWarpTool';
export { warpLayerId } from './warp/warpHandles';
export {
  useWidthTool, createWidthOverlay, createWidthActions, WIDTH_CLEAR_ID, WIDTH_DRAG_ID, WIDTH_HOVER_ID, WIDTH_UNHOVER_ID,
  type UseWidthToolOptions, type WidthEdgeHit, type WidthEnv, type WidthFocus, type WidthGrip, type WidthTarget,
} from './width';

// ─── Icons ─────────────────────────────────────────────────────────────────
export {
  BalanceHandlesIcon, BendAlongIcon, BlendIcon, DistortIcon, EnvelopeIcon, EqualizeHandlesIcon, ExpandIcon, ExtendIcon,
  GirthIcon, PuppetWarpIcon, RepeatAlongIcon, SmudgeBrushIcon, TrimIcon,
} from './icons';
export {
  ConvertSegmentIcon, CornerRadiusIcon, CornerShapeIcon, CurveSegmentIcon, ExtremeAnchorsIcon, ReversePathIcon,
  SetPathStartIcon, StraightenSegmentIcon,
} from './commandIcons';

// ─── Path-edit chrome ──────────────────────────────────────────────────────
export { combCommands, createCombExtension, PATH_COMB_CHROME_ID, type PathEditCombOptions } from './comb/comb';
export {
  balanceCommands, createBalanceExtension, PATH_BALANCE_CHROME_ID, type PathEditBalanceStyle,
} from './balance/balanceMarks';
export {
  CONSTRAINTS_EXTENSION_ID, createConstraintsExtension, selectedConstraintOf, setConstraints,
} from './constraints/constraintsExtension';
export type { ConstraintGlyphStyle } from './constraints/constraintGlyphs';
export {
  CORNER_WIDGET_STANDOFF_PX, cornerWidgetCommands, cornerWidgetFrames, createCornerWidgetsExtension,
  PATH_CORNERS_CHROME_ID, type CornerWidgetStyle,
} from './cornerShape/cornerWidgets';
export {
  createDirectionExtension, directionCommands, PATH_DIRECTION_CHROME_ID, type PathDirectionStyle,
} from './pathStructure/directionMarks';

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
