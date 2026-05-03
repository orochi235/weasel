/**
 * @orochi235/weasel — domain-agnostic 2D scene-graph primitives for React +
 * canvas apps. No assumptions about what an "object" is beyond `{ id }`; pose
 * shape is generic, units are pluggable, and every interaction is wired
 * through a narrow adapter the consumer implements.
 *
 * Surface map (broad strokes — see per-symbol JSDoc for detail):
 *   - View transform & viewport: `ViewTransform`, `worldToScreen`,
 *     `screenToWorld`, `fitZoom`, `useCanvasSize`, pixel-density helpers,
 *     `usePanInteraction`, `useZoomInteraction`, `useAutoCenter`,
 *     `wheelHandler`.
 *   - Layer composition: `RenderLayer`, `runLayers`, `LayerRenderer`,
 *     `createGridLayer`, `createCellHighlightLayer`, `createChildrenLayer`,
 *     `createSelectionOverlayLayer` and friends, `createTextLayer`,
 *     `createTilePattern`, `applyPaint` / `applyStroke`.
 *   - Interactions (gesture hooks): `useMoveInteraction`,
 *     `useResizeInteraction`, `useInsertInteraction`,
 *     `useAreaSelectInteraction`, `useCloneInteraction`,
 *     `useTextEditInteraction`, plus `useDragHandle` / `useDropZone` for
 *     ad-hoc pointer drags.
 *   - Action hooks (selection-driven, optional keybindings): `useDeleteAction`,
 *     `useEscapeAction`, `useSelectAllAction`, `useDuplicateAction`,
 *     `useNudgeAction`, `useReorderAction`, `useClipboardAction`,
 *     `useGroupAction`, `useUngroupAction`, `useUndoRedoAction`.
 *   - Op model & history: `Op`, `createInsertOp` / `createDeleteOp` /
 *     `createTransformOp` / etc., `createHistory`, `applyBatch`-style entry
 *     wired by every hook.
 *   - Units: `UnitSystem`, `UnitValue`, `IMPERIAL_INCHES`, `METRIC_MM`,
 *     `PIXELS`, `resolveUnit`, `formatUnit`.
 *   - Adapters: `SceneAdapter`, plus narrow per-hook subsets
 *     (`MoveAdapter`, `ResizeAdapter`, `InsertAdapter`, `OrderedAdapter`,
 *     `GroupAdapter`, action-specific adapters).
 *
 * Non-rect poses (Path, polygon, custom): the kit is generic over `TPose`.
 * Plug in two small projections so the rect-flavored machinery works on any
 * shape:
 *   - `PoseGeometry<TPose>` — read AABB + remap on resize. Default
 *     `RECT_POSE_GEOMETRY` for `{x,y,width,height}`; `pathPoseGeometry` for
 *     `Path`. Pass via `useResizeInteraction(adapter, { geometry })`.
 *   - `OriginProjection<TPose>` — read snap-origin + translate by delta. Used
 *     by `gridSnapStrategy` and `snapBackOrDelete` for non-rect poses. Default
 *     `RECT_ORIGIN_PROJECTION`; `pathOriginProjection` for `Path`. Pass via
 *     `gridSnapStrategy(spacing, { origin })` or `snapBackOrDelete({ ...,
 *     origin })`.
 *
 * Per-hook subpath imports: `snapToGrid` exists for move, resize, and insert
 * with different return shapes. Import from the hook-specific subpath to pick
 * the right one:
 *   import { snapToGrid } from '@orochi235/weasel/move';
 *   import { snapToGrid, clampMinSize } from '@orochi235/weasel/resize';
 *   import { snapToGrid } from '@orochi235/weasel/insert';
 */

export * from './grid';
export * from './dragGhost';
export * from './thresholdDrag';
export * from './pointerDrag';
export * from './useCanvasSize';
export { setupCanvasDpr, useFixedPixelRatio } from './pixelDensity';
export type { SetupCanvasDprOptions } from './pixelDensity';
export * from './hooks/useLayerEffect';
export * from './fitToBounds';
export * from './hooks/usePanInteraction';
export * from './hooks/useZoomInteraction';
export * from './hooks/useAutoCenter';
export { useGridCellHover } from './hooks/useGridCellHover';
export type {
  UseGridCellHoverOptions,
  UseGridCellHoverReturn,
} from './hooks/useGridCellHover';
export { useKeybinding, isEditableTarget } from './hooks/useKeybinding';
export type { KeyBinding } from './hooks/useKeybinding';
export * from './wheelHandler';
export * from './layers/renderLayer';
export * from './layers/LayerRenderer';
export { createGridLayer } from './layers/gridLayer';
export type { GridLayerOpts } from './layers/gridLayer';
export { createCellHighlightLayer } from './layers/cellHighlightLayer';
export type { CellHighlightLayerOpts } from './layers/cellHighlightLayer';
export { createChildrenLayer } from './layers/childrenLayer';
export type { CreateChildrenLayerOpts } from './layers/childrenLayer';
export {
  resolveUnit,
  formatUnit,
  IMPERIAL_INCHES,
  METRIC_MM,
  PIXELS,
} from './units';
export type { Unit, UnitSystem, UnitValue } from './units';
export {
  composeSelectionPose,
  createSelectionOutlineLayer,
  createSelectionHandlesLayer,
  createSelectionOverlayLayer,
} from './layers/selectionOverlay';
export type {
  ComposeSelectionPoseOpts,
  SelectionOutlineLayerOpts,
  SelectionHandlesLayerOpts,
  SelectionOverlayLayerOpts,
} from './layers/selectionOverlay';
export * from './renderLabel';
export * from './text/markdownText';
export {
  DEFAULT_TEXT_STYLE,
  resolveTextStyle,
  fontString,
} from './text/textStyle';
export type { TextStyle, ResolvedTextStyle } from './text/textStyle';
export { measureText } from './text/measureText';
export type { MeasuredText } from './text/measureText';
export { createTextLayer } from './text/textLayer';
export type { TextPose, CreateTextLayerOpts } from './text/textLayer';
export { pointInTextPose, caretIndexAt } from './text/hitTest';
export { fitTextPose } from './text/fitTextPose';
export type { FitTextPoseOptions } from './text/fitTextPose';
export type { PointInTextPoseOpts } from './text/hitTest';
export { useTextEditInteraction } from './text/useTextEditInteraction';
export type {
  TextEditScreenPose,
  StartEditOptions,
  UseTextEditInteractionOptions,
  UseTextEditInteractionReturn,
} from './text/useTextEditInteraction';
export { createTilePattern } from './patterns';
export type { TilePatternOpts } from './patterns';
export {
  applyPaint,
  applyStroke,
  renderFilledRegion,
} from './paint';
export type {
  Paint,
  Stroke,
  Region,
  RenderFilledRegionOptions,
} from './paint';
export * from './ops';
export {
  composeWorldPose,
  composeRectPose,
  decomposeRectPose,
  rebaseLocalPose,
  worldPoseLookup,
} from './transforms/composePose';
export type { PoseAdapter } from './transforms/composePose';
export {
  PATH_M,
  PATH_L,
  PATH_C,
  PATH_Q,
  PATH_Z,
  PATH_CMD_LENGTHS,
  PathBuilder,
  polygonFromPoints,
  rectPath,
  boundsOfPath,
  pointInPath,
  translatePath,
  translatePolygonInPlace,
  scalePathToBounds,
  traceToContext,
  createPathLayer,
  flattenCubic,
  flattenQuadratic,
  DEFAULT_FLATTEN_TOLERANCE,
  composePath,
  decomposePath,
  unionBoundsPath,
  pathPoseGeometry,
  pathOriginProjection,
} from './paths';
export type {
  Path,
  PolygonPath,
  RectPath,
  PathFillRule,
  PointInPathOptions,
  CreatePathLayerOpts,
} from './paths';
export type { Group, GroupAdapter } from './groups/types';
export { resolveToOutermostGroup, expandToLeaves } from './groups/resolve';
export { unionBounds } from './groups/unionBounds';
export type { RectPose } from './groups/unionBounds';
export { withGroupOrdering } from './groups/orderedGroups';
export * from './chrome';
export * from './history';
export * from './adapters/types';
export type {
  ModifierState,
  PointerState,
  GestureContext,
  SnapStrategy,
  GestureBehavior,
  BehaviorMoveResult,
  MoveBehavior,
  MoveOverlay,
  ResizeAnchor,
  ResizePose,
  ResizeProposed,
  ResizeMoveResult,
  ResizeBehavior,
  ResizeOverlay,
  InsertProposed,
  InsertMoveResult,
  InsertBehavior,
  InsertOverlay,
  AreaSelectPose,
  AreaSelectProposed,
  AreaSelectMoveResult,
  AreaSelectBehavior,
  AreaSelectOverlay,
} from './interactions/gestures/types';
export type { ClipboardSnapshot } from './interactions/clipboard/types';
export {
  snap,
  gridSnapStrategy,
  pointToGridCell,
  RECT_ORIGIN_PROJECTION,
} from './interactions/gestures/shared';
export type { OriginProjection } from './interactions/gestures/shared';
export { useMoveInteraction } from './interactions/gestures/move';
export type {
  UseMoveInteractionOptions,
  UseMoveInteractionReturn,
  MoveStartArgs,
  MoveMoveArgs,
} from './interactions/gestures/move';
export { useResizeInteraction, RECT_POSE_GEOMETRY } from './interactions/gestures/resize';
export type {
  UseResizeInteractionOptions,
  UseResizeInteractionReturn,
  PoseGeometry,
} from './interactions/gestures/resize';
export { useInsertInteraction } from './interactions/gestures/insert';
export type {
  UseInsertInteractionOptions,
  UseInsertInteractionReturn,
} from './interactions/gestures/insert';
export { useAreaSelectInteraction } from './interactions/gestures/area-select';
export type {
  UseAreaSelectInteractionOptions,
  UseAreaSelectInteractionReturn,
} from './interactions/gestures/area-select';
export {
  useClipboard,
  useClipboardAction,
} from './interactions/clipboard';
export type {
  UseClipboardOptions,
  UseClipboardReturn,
  ClipboardActionAdapter,
  UseClipboardActionOptions,
  UseClipboardActionReturn,
} from './interactions/clipboard';
export { useDeleteAction } from './interactions/actions/delete';
export type {
  DeleteAdapter,
  UseDeleteActionOptions,
  UseDeleteActionReturn,
} from './interactions/actions/delete';
export { useEscapeAction } from './interactions/actions/escape';
export type {
  EscapeAdapter,
  UseEscapeActionOptions,
  UseEscapeActionReturn,
} from './interactions/actions/escape';
export { useSelectAllAction } from './interactions/actions/select-all';
export type {
  SelectAllAdapter,
  UseSelectAllActionOptions,
  UseSelectAllActionReturn,
} from './interactions/actions/select-all';
export { useDuplicateAction } from './interactions/actions/duplicate';
export type {
  DuplicateAdapter,
  UseDuplicateActionOptions,
  UseDuplicateActionReturn,
} from './interactions/actions/duplicate';
export { useNudgeAction } from './interactions/actions/nudge';
export type {
  NudgeAdapter,
  NudgeDirection,
  UseNudgeActionOptions,
  UseNudgeActionReturn,
} from './interactions/actions/nudge';
export { useCloneInteraction, cloneByAltDrag } from './interactions/gestures/clone';
export type { UseCloneInteractionOptions, UseCloneInteractionReturn } from './interactions/gestures/clone';
export type { ClonePose, CloneLayer, CloneBehavior } from './interactions/gestures/types';
// snapToGrid / snapToContainer / snapBackOrDelete are NOT re-exported at top level —
// import from './move' to disambiguate from resize/insert siblings.
export {
  createBringForwardOp,
  createSendBackwardOp,
  createBringToFrontOp,
  createSendToBackOp,
  createMoveToIndexOp,
} from './ops/reorder';
export {
  useReorderAction,
  type ReorderAdapter,
  type UseReorderActionOptions,
  type UseReorderActionReturn,
} from './interactions/actions/reorder';
export {
  useGroupAction,
  useUngroupAction,
  useNestedGroupAction,
  useNestedUngroupAction,
} from './interactions/actions/group';
export type {
  GroupActionAdapter,
  UseGroupActionOptions,
  UseGroupActionReturn,
  UseUngroupActionOptions,
  UseUngroupActionReturn,
  NestedGroupActionAdapter,
  UseNestedGroupActionOptions,
  UseNestedGroupActionReturn,
  UseNestedUngroupActionOptions,
  UseNestedUngroupActionReturn,
} from './interactions/actions/group';
export { useUndoRedoAction } from './interactions/actions/undo-redo';
export type {
  UndoRedoAdapter,
  UseUndoRedoActionOptions,
  UseUndoRedoActionReturn,
} from './interactions/actions/undo-redo';
