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
export * from './renderLayer';
export * from './LayerRenderer';
export { createGridLayer } from './gridLayer';
export type { GridLayerOpts } from './gridLayer';
export { createCellHighlightLayer } from './cellHighlightLayer';
export type { CellHighlightLayerOpts } from './cellHighlightLayer';
export { createChildrenLayer } from './childrenLayer';
export type { CreateChildrenLayerOpts } from './childrenLayer';
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
} from './selectionOverlay';
export type {
  ComposeSelectionPoseOpts,
  SelectionOutlineLayerOpts,
  SelectionHandlesLayerOpts,
  SelectionOverlayLayerOpts,
} from './selectionOverlay';
export * from './renderLabel';
export * from './markdownText';
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
export { pointInTextPose } from './text/hitTest';
export type { PointInTextPoseOpts } from './text/hitTest';
export { useTextEditInteraction } from './text/useTextEditInteraction';
export type {
  TextEditScreenPose,
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
export type { Group, GroupAdapter } from './groups/types';
export { resolveToOutermostGroup, expandToLeaves } from './groups/resolve';
export { unionBounds } from './groups/unionBounds';
export type { RectPose } from './groups/unionBounds';
export { withGroupOrdering } from './groups/orderedGroups';
export * from './history';
export * from './adapters/types';
export * from './interactions/types';
export { snap, gridSnapStrategy, pointToGridCell } from './interactions/shared';
export { useMoveInteraction } from './interactions/move';
export type {
  UseMoveInteractionOptions,
  UseMoveInteractionReturn,
  MoveStartArgs,
  MoveMoveArgs,
} from './interactions/move';
export { useResizeInteraction } from './interactions/resize';
export type {
  UseResizeInteractionOptions,
  UseResizeInteractionReturn,
} from './interactions/resize';
export { useInsertInteraction } from './interactions/insert';
export type {
  UseInsertInteractionOptions,
  UseInsertInteractionReturn,
} from './interactions/insert';
export { useAreaSelectInteraction } from './interactions/area-select';
export type {
  UseAreaSelectInteractionOptions,
  UseAreaSelectInteractionReturn,
} from './interactions/area-select';
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
export { useDeleteAction } from './interactions/delete';
export type {
  DeleteAdapter,
  UseDeleteActionOptions,
  UseDeleteActionReturn,
} from './interactions/delete';
export { useEscapeAction } from './interactions/escape';
export type {
  EscapeAdapter,
  UseEscapeActionOptions,
  UseEscapeActionReturn,
} from './interactions/escape';
export { useSelectAllAction } from './interactions/select-all';
export type {
  SelectAllAdapter,
  UseSelectAllActionOptions,
  UseSelectAllActionReturn,
} from './interactions/select-all';
export { useDuplicateAction } from './interactions/duplicate';
export type {
  DuplicateAdapter,
  UseDuplicateActionOptions,
  UseDuplicateActionReturn,
} from './interactions/duplicate';
export { useNudgeAction } from './interactions/nudge';
export type {
  NudgeAdapter,
  NudgeDirection,
  UseNudgeActionOptions,
  UseNudgeActionReturn,
} from './interactions/nudge';
export { useCloneInteraction, cloneByAltDrag } from './interactions/clone';
export type { UseCloneInteractionOptions, UseCloneInteractionReturn } from './interactions/clone';
export type { ClonePose, CloneLayer, CloneBehavior } from './interactions/types';
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
} from './interactions/reorder';
export {
  useGroupAction,
  useUngroupAction,
  useStructuralGroupAction,
  useStructuralUngroupAction,
} from './interactions/group';
export type {
  GroupActionAdapter,
  UseGroupActionOptions,
  UseGroupActionReturn,
  UseUngroupActionOptions,
  UseUngroupActionReturn,
  StructuralGroupActionAdapter,
  UseStructuralGroupActionOptions,
  UseStructuralGroupActionReturn,
  UseStructuralUngroupActionOptions,
  UseStructuralUngroupActionReturn,
} from './interactions/group';
export { useUndoRedoAction } from './interactions/undo-redo';
export type {
  UndoRedoAdapter,
  UseUndoRedoActionOptions,
  UseUndoRedoActionReturn,
} from './interactions/undo-redo';
