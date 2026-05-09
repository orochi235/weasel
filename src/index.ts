/**
 * @orochi235/weasel — domain-agnostic 2D scene-graph primitives for React +
 * canvas apps. No assumptions about what an "object" is beyond `{ id }`; pose
 * shape is generic, units are pluggable, and every interaction is wired
 * through a narrow adapter the consumer implements.
 *
 * Surface map (broad strokes — see per-symbol JSDoc for detail):
 *   - View transform & viewport: `ViewTransform`, `worldToScreen`,
 *     `screenToWorld`, `fitZoom`, `useCanvasSize`,
 *     `useZoom`, `useAutoCenter`, `zoomAt`,
 *     `wheelHandler`.
 *   - Layer composition: `RenderLayer`,
 *     `createGridLayer`, `createCellHighlightLayer`, `createChildrenLayer`,
 *     `createSelectionOverlayLayer` and friends, `createTextLayer`,
 *     `createTilePattern`.
 *   - Interactions (gesture hooks): `useMove`,
 *     `useResize`, `useInsert`,
 *     `useAreaSelect`, `useClone`,
 *     `useTextEdit`, plus `useDragHandle` / `useDropZone` for
 *     ad-hoc pointer drags.
 *   - Action hooks (selection-driven, optional keybindings): `useDelete`,
 *     `useEscape`, `useSelectAll`, `useDuplicate`,
 *     `useNudge`, `useReorder`, `useClipboard`,
 *     `useGroup`, `useUngroup`, `useUndoRedo`.
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
 *   - `PoseDescriptor<TPose>` — read AABB + remap on resize. Default
 *     `RECT_POSE_DESCRIPTOR` for `{x,y,width,height}`; `pathPoseDescriptor` for
 *     `Path`. Pass via `useResize(adapter, { geometry })`.
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

export * from './features/grid';
export * from './core/viewport/viewTransform';
export type { View } from './core/viewport/view';
export * from './features/drag/thresholdDrag';
export * from './features/drag/pointerDrag';
export * from './core/viewport/useCanvasSize';
export * from './core/viewport/fitToBounds';
export { zoomAt } from './core/viewport/zoomAt';
export type { ZoomClampOpts } from './core/viewport/zoomAt';
export { clampView } from './core/viewport/clampView';
export type { ClampBounds, CanvasSize } from './core/viewport/clampView';
export * from './core/viewport/useZoom';
export * from './core/viewport/useAutoCenter';
export { useKeybinding, isEditableTarget } from './interactions/actions/useKeybinding';
export type { KeyBinding } from './interactions/actions/useKeybinding';

// --- @experimental Actions Registry (2026-05-09) ----------------------------
export {
  ActionsProvider, useActionsRegistry, useAction, evaluateEnabled,
  ActionDisabledReason,
} from './interactions/actions/registry';
export type {
  Action, ActionEntry, ActionsProp, ActionsRegistry, ActionEnabledResult,
} from './interactions/actions/registry';
export {
  defaultSelectAllAction, defaultEscapeAction, defaultDuplicateAction,
  defaultNudgeActions, defaultReorderActions,
} from './interactions/actions/defaults';
export type {
  SelectAllDeps, EscapeDeps, DuplicateDeps, NudgeDeps, ReorderDeps,
} from './interactions/actions/defaults';
export { useStandardActions } from './interactions/actions/useStandardActions';
export type {
  UseStandardActionsOptions,
  StandardActionsDeps,
  StandardActionDefaults,
} from './interactions/actions/useStandardActions';
export { resolveActions } from './interactions/actions/resolveActions';
export * from './core/viewport/wheelHandler';
export { clientToCanvas } from './core/viewport/clientToCanvas';
export { useVelocityTracker } from './core/viewport/useVelocityTracker';
export { useDecayLoop } from './core/viewport/useDecayLoop';
export type { DecayLoopConfig, PanBounds } from './core/viewport/useDecayLoop';
export { useViewTween } from './core/viewport/useViewTween';
export { usePinchGesture } from './core/viewport/usePinchGesture';
export { useViewAnimation } from './core/viewport/useViewAnimation';
export { usePointerGestures } from './interactions/usePointerGestures';
export * from './tools';
export { usePinchZoomTool, type PinchZoomToolOpts } from './tools/builtin/usePinchZoomTool';
export type {
  PointerGestureBindings,
  UsePointerGesturesOptions,
  PointerGestureCallbackCtx,
} from './interactions/usePointerGestures';
export { Canvas } from './canvas/Canvas';
export { SceneCanvas } from './canvas/SceneCanvas';
export type { SceneCanvasProps } from './canvas/SceneCanvas';
export { sceneToAdapter } from './canvas/sceneAdapter';
export type { SceneCanvasAdapter } from './canvas/sceneAdapter';
export type {
  CanvasProps,
  CanvasHelpers,
  CanvasSelectionMode,
  StandardSlotName,
  CustomLayerEntry,
  GridSlotConfig,
} from './canvas/Canvas';
export { useSelection } from './features/selection/useSelection';
export type {
  SelectionApi,
  SelectionMode,
  SelectionExtendKey,
  UseSelectionOptions,
} from './features/selection/useSelection';
// --- @experimental Selection ambient context (2026-05-09) -------------------
export {
  SelectionContextProvider,
  useSelectionContext,
  usePublishSelection,
} from './features/selection/SelectionContext';
export type { SelectionContextValue } from './features/selection/SelectionContext';
export {
  useCanvasFocus,
  gateLayer,
} from './features/focus';
export type {
  UseCanvasFocusOptions,
  CanvasFocusReturn,
  GateLayerOptions,
} from './features/focus';
export * from './core/layers/render';
export { createChildrenLayer } from './features/groups/children';
export type { CreateChildrenLayerOpts } from './features/groups/children';
export {
  resolveUnit,
  formatUnit,
  IMPERIAL_INCHES,
  METRIC_MM,
  PIXELS,
} from './core/units';
export type { Unit, UnitSystem, UnitValue } from './core/units';
export {
  composeSelectionPose,
  createSelectionOutlineLayer,
  createSelectionHandlesLayer,
  createSelectionOverlayLayer,
} from './features/selection/overlay';
export type {
  ComposeSelectionPoseOpts,
  SelectionOutlineLayerOpts,
  SelectionHandlesLayerOpts,
  SelectionOverlayLayerOpts,
} from './features/selection/overlay';
export * from './features/text/renderLabel';
export * from './features/text/markdownText';
export {
  DEFAULT_TEXT_STYLE,
  resolveTextStyle,
  fontString,
} from './features/text/textStyle';
export type { TextStyle, ResolvedTextStyle } from './features/text/textStyle';
export { measureText } from './features/text/measureText';
export type { MeasuredText } from './features/text/measureText';
export { createTextLayer } from './features/text/textLayer';
export type { TextPose, CreateTextLayerOpts } from './features/text/textLayer';
export { pointInTextPose, caretIndexAt } from './features/text/hitTest';
export { fitTextPose } from './features/text/fitTextPose';
export type { FitTextPoseOptions } from './features/text/fitTextPose';
export type { PointInTextPoseOpts } from './features/text/hitTest';
export { useTextEdit } from './features/text/useTextEdit';
export type {
  TextEditScreenPose,
  StartEditOptions,
  UseTextEditOptions,
  UseTextEditReturn,
} from './features/text/useTextEdit';
export { createTilePattern } from './features/patterns';
export type { TilePatternOpts } from './features/patterns';
export { alignedStrokeRect } from './core/paint-types';
export type {
  Paint,
  GradStop,
  Stroke,
  StrokeAlign,
  Region,
} from './core/paint-types';
export * from './core/ops';
export {
  composeWorldPose,
  composeRectPose,
  decomposeRectPose,
  rebaseLocalPose,
  translateRectPose,
  worldPoseLookup,
} from './features/groups/composePose';
export type { PoseAdapter } from './features/groups/composePose';
export { nestedGroupHitTester } from './interactions/hit/nestedGroupHit';
export type {
  NestedGroupHitOpts,
  NestedGroupHitTester,
} from './interactions/hit/nestedGroupHit';
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
  createPathLayer,
  flattenCubic,
  flattenQuadratic,
  DEFAULT_FLATTEN_TOLERANCE,
  composePath,
  decomposePath,
  unionBoundsPath,
  pathPoseDescriptor,
  pathOriginProjection,
  createPenPreviewLayer,
} from './features/paths';
export type {
  Path,
  PolygonPath,
  RectPath,
  PathFillRule,
  PointInPathOptions,
  CreatePathLayerOpts,
  CreatePenPreviewLayerOptions,
  PenPreviewStyle,
} from './features/paths';
export { constrainTo45 } from './util/constrainTo45';
export type { Group, GroupAdapter } from './features/groups/types';
export { resolveToOutermostGroup, expandToLeaves } from './features/groups/resolve';
export { unionBounds } from './features/groups/unionBounds';
export type { RectPose } from './features/groups/unionBounds';
export { withGroupOrdering } from './features/groups/orderedGroups';
export * from './core/history';
export * from './core/adapters/types';
export { arrayAdapter } from './core/adapters/arrayAdapter';
export type { ArrayAdapter, ArrayAdapterConfig } from './core/adapters/arrayAdapter';
export { useArrayAdapter } from './core/adapters/useArrayAdapter';
export type { UseArrayAdapterOptions } from './core/adapters/useArrayAdapter';
export { createScene, useScene, asNodeId } from './core/scene';
export type {
  AddNodeSpec,
  ContainerNode,
  LayerRecord,
  LeafNode,
  Node as SceneNode,
  NodeId,
  RegisteredOp,
  Scene,
  SystemLayerRecord,
  SystemLayerSpec,
  UserLayerRecord,
  UseSceneOptions,
} from './core/scene';
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
  RotatedPose,
  RotateProposed,
  RotateMoveResult,
  RotateBehavior,
  RotateOverlay,
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
export type { ClipboardSnapshot } from './interactions/actions/clipboard/types';
export {
  snap,
  gridSnapStrategy,
  pointToGridCell,
  RECT_ORIGIN_PROJECTION,
} from './interactions/gestures/shared';
export type { OriginProjection } from './interactions/gestures/shared';
export { useMove } from './interactions/gestures/move';
export type {
  UseMoveOptions,
  MoveController,
  MoveStartArgs,
  MoveMoveArgs,
} from './interactions/gestures/move';
export {
  useResize,
  RECT_POSE_DESCRIPTOR,
  ROTATED_POSE_DESCRIPTOR,
  cornerResizeHandles,
  hitCornerHandle,
} from './interactions/gestures/resize';
export type {
  UseResizeOptions,
  ResizeController,
  PoseDescriptor,
  CornerHandle,
} from './interactions/gestures/resize';
export {
  useRotate,
  pointInRotatedRect,
  rotatedRectCorners,
  rectCorners,
  rotatePoint,
  aabbCenter,
  rotationHandle,
  hitRotationHandle,
  DEFAULT_ROTATION_HANDLE_DISTANCE,
} from './interactions/gestures/rotate';
export type {
  UseRotateOptions,
  RotateController,
  RotateStartArgs,
  RotateMoveArgs,
  RotateGeometry,
  RotationHandle,
} from './interactions/gestures/rotate';
export { useInsert } from './interactions/gestures/insert';
export type {
  UseInsertOptions,
  InsertController,
} from './interactions/gestures/insert';
export { useDragRect } from './interactions/gestures/dragRect';
export type {
  DragRectController,
  DragRectCtx,
  DragRectEndCtx,
  UseDragRectOptions,
  DragRectPoint,
  DragRectBounds,
} from './interactions/gestures/dragRect';
export { useDragGesture } from './interactions/gestures/dragGesture';
export type {
  UseDragGestureOptions,
  DragGestureController,
  DragGestureCtx,
  DragGestureEndCtx,
  DragGesturePoint,
  DragGesturePhase,
} from './interactions/gestures/dragGesture';
export { useAreaSelect } from './interactions/gestures/area-select';
export {
  useEditAnchors,
  hitAnchor,
  enumerateAnchors,
  withCoord,
  createAnchorEditOverlayLayer,
} from './interactions/gestures/edit-anchors';
export type {
  UseEditAnchorsOptions,
  EditAnchorsController,
  EditAnchorsAdapter,
  EditAnchorsOverlay,
  EditAnchorsStartArgs,
  EditAnchorsMoveArgs,
  AnchorHit,
  PathAnchor,
  AnchorEditOverlayOpts,
} from './interactions/gestures/edit-anchors';
export type {
  UseAreaSelectOptions,
  AreaSelectController,
} from './interactions/gestures/area-select';
export { selectFromMarquee } from './interactions/gestures/area-select/behaviors';
export {
  useClipboardOps,
  useClipboard,
} from './interactions/actions/clipboard';
export type {
  UseClipboardOpsOptions,
  UseClipboardOpsReturn,
  ClipboardAdapter,
  UseClipboardOptions,
  UseClipboardReturn,
} from './interactions/actions/clipboard';
export { useDelete } from './interactions/actions/delete';
export type {
  DeleteAdapter,
  UseDeleteOptions,
  UseDeleteReturn,
} from './interactions/actions/delete';
export { useEscape } from './interactions/actions/escape';
export type {
  EscapeAdapter,
  UseEscapeOptions,
  UseEscapeReturn,
} from './interactions/actions/escape';
export { useSelectAll } from './interactions/actions/select-all';
export type {
  SelectAllAdapter,
  UseSelectAllOptions,
  UseSelectAllReturn,
} from './interactions/actions/select-all';
export { useDuplicate } from './interactions/actions/duplicate';
export type {
  DuplicateAdapter,
  UseDuplicateOptions,
  UseDuplicateReturn,
} from './interactions/actions/duplicate';
export { useNudge } from './interactions/actions/nudge';
export type {
  NudgeAdapter,
  NudgeDirection,
  UseNudgeOptions,
  UseNudgeReturn,
} from './interactions/actions/nudge';
export { useClone, cloneByAltDrag } from './interactions/gestures/clone';
export type { UseCloneOptions, UseCloneReturn } from './interactions/gestures/clone';
export type { ClonePose, CloneLayer, CloneBehavior } from './interactions/gestures/types';
// snapToGrid / snapToContainer / snapBackOrDelete are NOT re-exported at top level —
// import from './move' to disambiguate from resize/insert siblings.
export {
  createReorderOp,
  createMoveToIndexOp,
} from './core/ops/reorder';
export type { ReorderDirection } from './core/ops/reorder';
export {
  useReorder,
  type ReorderAdapter,
  type UseReorderOptions,
  type UseReorderReturn,
} from './interactions/actions/reorder';
export {
  useGroup,
  useUngroup,
  useNestedGroup,
  useNestedUngroup,
} from './interactions/actions/group';
export type {
  GroupActionAdapter,
  UseGroupOptions,
  UseGroupReturn,
  UseUngroupOptions,
  UseUngroupReturn,
  NestedGroupActionAdapter,
  UseNestedGroupOptions,
  UseNestedGroupReturn,
  UseNestedUngroupOptions,
  UseNestedUngroupReturn,
} from './interactions/actions/group';
export { useUndoRedo } from './interactions/actions/undo-redo';
export type {
  UndoRedoAdapter,
  UseUndoRedoOptions,
  UseUndoRedoReturn,
} from './interactions/actions/undo-redo';

// Debug overlay subsystem
export * from './debug';

// Animation primitives
export * from './animation';

// Layout strategies
export * from './layout';
