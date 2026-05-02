/**
 * canvas-kit — domain-agnostic 2D scene graph primitives.
 *
 * Viewport math, pointer-driven drag, layered canvas rendering, and a few
 * generic renderers (grid, labels, markdown text). Everything in this barrel
 * is free of garden-specific types so it can power the drag-lab and any
 * future apps without a unifying domain underneath.
 *
 * Currently exposed (Tier 1 — verbatim moves from `utils/` and `canvas/`):
 *   - View transform: `ViewTransform`, `worldToScreen`, `screenToWorld`, `roundToCell`
 *   - Pointer drag: `useDragHandle`, `useDropZone`, `DragPayload`, threshold helpers
 *   - Drag ghost: `createDragGhost`
 *   - Canvas plumbing: `useCanvasSize`, `useLayerEffect`, `fitZoom`
 *   - Layer composition: `RenderLayer`, `runLayers`, `LayerRenderer`
 *   - Renderers: `createGridLayer`, `renderLabel`, markdown text utilities, pattern cache
 *
 * Per-hook subpath imports: `snapToGrid` exists for move, resize, and insert
 * with different return shapes. Import from the hook-specific subpath:
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
export { useKeybinding, isEditableTarget } from './hooks/useKeybinding';
export type { KeyBinding } from './hooks/useKeybinding';
export * from './wheelHandler';
export * from './renderLayer';
export * from './LayerRenderer';
export { createGridLayer } from './gridLayer';
export type { GridLayerOpts } from './gridLayer';
export { createCellHighlightLayer } from './cellHighlightLayer';
export type { CellHighlightLayerOpts } from './cellHighlightLayer';
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
export type { Group, GroupAdapter } from './groups/types';
export { resolveToOutermostGroup, expandToLeaves } from './groups/resolve';
export { unionBounds } from './groups/unionBounds';
export type { RectPose } from './groups/unionBounds';
export * from './history';
export * from './adapters/types';
export * from './interactions/types';
export { snap, gridSnapStrategy } from './interactions/shared';
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
export { useClipboard } from './interactions/clipboard';
export type { UseClipboardOptions, UseClipboardReturn } from './interactions/clipboard';
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
export type { OrderedAdapter } from './adapters/types';
export { withGroupOrdering } from './groups/orderedGroups';
