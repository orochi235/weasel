/**
 * @orochi235/weasel — domain-agnostic 2D scene-graph primitives for React +
 * canvas apps. A scene is a tree of `SceneNode`s; the kit makes no assumption
 * about a node's payload beyond `{ id }`. Pose shape is generic, units are
 * pluggable, and every interaction is wired through a narrow adapter the
 * consumer implements.
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
 *   - Interactions (gesture hooks): `useTextEdit`, plus `useDragHandle` /
 *     `useDropZone` for ad-hoc pointer drags. Resize and move are
 *     dispatcher-driven via the Actions Registry (`resizeAction` /
 *     `moveAction`) — there's no standalone hook to call.
 *   - Actions: the Actions Registry (`ActionsProvider`, `useStandardActions`,
 *     and the per-action descriptors at `interactions/actions/defaults/`).
 *     Standalone consumer hooks (`useDelete`, `useEscape`, ...) were removed
 *     in favor of the descriptor + dispatcher path.
 *   - Op model & history: `Op`, `createInsertOp` / `createDeleteOp` /
 *     `createTransformOp` / etc., `createHistory`, `applyOps`-style entry
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
 *   - `PoseProjection<TPose>` — read AABB + remap on resize. Default
 *     `RECT_POSE_DESCRIPTOR` for `{x,y,width,height}`; `pathPoseDescriptor` for
 *     `Path`. Pass via the `resizePolicy` dep (`useResizePolicy({
 *     projection })`).
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

// ─── Features: grids, multi-viewport composition ────────────────────────────
export * from './features/grid';
export * from './features/viewports';
export * from './features/parallax';
export * from './features/simulation';

// ─── Pointer input: stylus / coalesced events / pressure ────────────────────
export {
  getStylusData,
  forEachCoalesced,
  pressureToWidth,
} from './core/pointer/stylus';
export type {
  StylusData,
  PointerSample,
  CoalescedCtx,
  PressureToWidthOptions,
} from './core/pointer/stylus';
export { usePointerStylus } from './core/pointer/usePointerStylus';
export type {
  PointerStylusState,
  UsePointerStylusOptions,
} from './core/pointer/usePointerStylus';

// ─── Viewport: ViewTransform + helpers ──────────────────────────────────────
export * from './core/viewport/viewTransform';
export type { View, ZoomFactor, ZoomBound } from './core/viewport/view';
export { viewToTransform } from './core/viewport/view';
export { meanScale } from './core/viewport/meanScale';
export * from './interactions/gestures/handleDrag';
export * from './interactions/gestures/pointerDrag';
export * from './interactions/gestures/thresholdDrag';
export * from './core/viewport/useCanvasSize';
export * from './core/viewport/fitToBounds';
export { fitViewToBounds } from './core/viewport/fitViewToBounds';
export type { Bounds, ViewportDims, FitViewToBoundsOptions } from './core/viewport/fitViewToBounds';
export { zoomAt } from './core/viewport/zoomAt';
export type { ZoomClampOpts } from './core/viewport/zoomAt';
export { clampView } from './core/viewport/clampView';
export type { ClampBounds, CanvasSize } from './core/viewport/clampView';
export * from './core/viewport/useZoom';
export * from './core/viewport/useAutoCenter';
// ─── Keybindings: low-level key → action wiring ─────────────────────────────
export { isEditableTarget, matchesKeyBinding } from './interactions/keyHelpers';
export type { KeyBinding } from './interactions/keyHelpers';

// --- @experimental Actions Registry (2026-05-09) ----------------------------
export {
  ActionsProvider, useActionsRegistry, useAction, evaluateEnabled,
  ActionDisabledReason,
} from './interactions/actions/registry';
export type {
  Action, ActionEntry, ActionsProp, ActionsRegistry, ActionEnabledResult,
} from './interactions/actions/registry';
export { moveAction } from './interactions/actions/defaults/move';
export { resizeAction } from './interactions/actions/defaults/resize';
export { rotateAction } from './interactions/actions/defaults/rotate';
export { areaSelectAction } from './interactions/actions/defaults/areaSelect';
export { insertAction } from './interactions/actions/defaults/insert';
export { clearSelectionAction } from './interactions/actions/defaults/clearSelection';
export { cloneAction } from './interactions/actions/defaults/clone';
export { viewportDragPanAction } from './interactions/actions/defaults/viewportDragPan';
export { editAnchorsAction } from './interactions/actions/defaults/editAnchors';
export { lassoSelectAction } from './interactions/actions/defaults/lassoSelect';
export { pinchZoomAction } from './interactions/actions/defaults/pinchZoom';
export { enterTextEditAction } from './interactions/actions/defaults/enterTextEdit';
export type { TextEditDep } from './interactions/actions/defaults/enterTextEdit';
export { useStandardActions } from './interactions/actions/useStandardActions';
export type { UseStandardActionsOptions } from './interactions/actions/useStandardActions';

// ─── Invoker / GestureBinding / ActiveToolContext (Phase 1 of registry unification) ───
export type {
  Point2,
  InvocationCtx,
  BindingOpts,
  ActionDeps,
  OngoingHandle,
  OngoingOverlay,
  ImmediateInvoker,
  OngoingInvoker,
  Invoker,
} from './interactions/actions/invoker';
export type { GestureBinding } from './interactions/actions/binding';
export {
  ActiveToolContextProvider,
  useActiveToolContext,
} from './interactions/actions/activeToolContext';
export type {
  ActiveToolContextValue,
  ActiveToolContextProviderProps,
} from './interactions/actions/activeToolContext';

// ─── Dep registry (Phase 3 of registry unification) ───
export {
  DepRegistryProvider,
  useDepRegistry,
  useDepSource,
} from './interactions/actions/depRegistry';
export type {
  DepSchema,
  DepName,
  DepRegistry,
} from './interactions/actions/depRegistry';
export type { ResizePolicy } from './interactions/actions/depSchema';
export {
  useResizePolicy,
  type UseResizePolicyOptions,
} from './canvas/deps/useResizePolicy';

// ─── Gesture dispatcher (Phase 3 of registry unification) ───
export {
  useGestureDispatcher,
  createDispatcher,
} from './interactions/dispatcher';
export type {
  Dispatcher,
  DispatcherContext,
  InputEvent,
  BindingScope,
  ScopedBinding,
  MatchResult,
  UseGestureDispatcherOptions,
} from './interactions/dispatcher';

// ─── Viewport: wheel / velocity / decay / tween / pinch / animation ─────────
export * from './core/viewport/wheelHandler';
export { clientToCanvas } from './core/viewport/clientToCanvas';
export { useVelocityTracker } from './core/viewport/useVelocityTracker';
export { useDecayLoop } from './core/viewport/useDecayLoop';
export type { DecayLoopConfig, PanBounds } from './core/viewport/useDecayLoop';
export { useViewTween } from './core/viewport/useViewTween';
export { usePinchGesture } from './core/viewport/usePinchGesture';
export { useViewAnimation } from './core/viewport/useViewAnimation';

// ─── Pointer gestures: low-level capture wrapper ────────────────────────────
export { usePointerGestures } from './interactions/gestures/usePointerGestures';

// ─── Tools: dispatcher, registry, declarative routing, built-ins ────────────
export * from './tools';
export { usePinchZoomTool, type PinchZoomToolOpts } from './tools/builtin/usePinchZoomTool';
// New declarative routing surface — experimental.
// import { defineTool } from '@orochi235/weasel/routing';
export * as routing from './tools/routing';
export type {
  PointerGestureBindings,
  UsePointerGesturesOptions,
  PointerGestureCallbackCtx,
} from './interactions/gestures/usePointerGestures';

// ─── Canvas + SceneCanvas: top-level renderers ──────────────────────────────
export { Canvas } from './canvas/Canvas';
export { SceneCanvas, DEFAULT_HANDLE_SIZE, defaultDrawOne } from './canvas/SceneCanvas';
export type { SceneCanvasProps } from './canvas/SceneCanvas';
export { CursorCoordsHud } from './canvas/CursorCoordsHud';
export type { CursorCoordsHudProps } from './canvas/CursorCoordsHud';
export {
  registerShapePainter,
  findShapePainter,
  findShapeSilhouette,
  getShapePainters,
} from './canvas/shapePainters';
export type {
  ShapePainter,
  RegisterShapePainterOptions,
} from './canvas/shapePainters';
export { sceneToAdapter, useSceneAdapter } from './canvas/sceneAdapter';
export type { SceneCanvasAdapter } from './canvas/sceneAdapter';
export type {
  CanvasProps,
  CanvasHelpers,
  CanvasSelectionMode,
  StandardSlotName,
  CustomLayerEntry,
  GridSlotConfig,
} from './canvas/Canvas';
export type { CanvasExtensionApi } from './canvas/canvasExtension';

// ─── Selection state hook ───────────────────────────────────────────────────
export { useSelection } from './core/selection/useSelection';
export type {
  SelectionApi,
  SelectionMode,
  SelectionExtendKey,
  UseSelectionOptions,
} from './core/selection/useSelection';
// --- @experimental Selection ambient context (2026-05-09) -------------------
export {
  SelectionContextProvider,
  useSelectionContext,
  usePublishSelection,
} from './features/selection/SelectionContext';
export type { SelectionContextValue } from './features/selection/SelectionContext';

// --- @experimental Pointer ambient context (2026-05-16) ---------------------
export {
  PointerContextProvider,
  usePointerContext,
} from './features/pointer/PointerContext';
export type { PointerContextValue, PointerWorldPos } from './features/pointer/PointerContext';

// ─── Canvas focus & visibility gating ───────────────────────────────────────
export {
  useCanvasFocus,
  gateLayer,
} from './features/focus';
export type {
  UseCanvasFocusOptions,
  CanvasFocusReturn,
  GateLayerOptions,
} from './features/focus';

// ─── Layer primitives: RenderLayer, ordered children ────────────────────────
export * from './core/layers/render';
export { createChildrenLayer } from './features/groups/children';
export type { CreateChildrenLayerOpts } from './features/groups/children';

// ─── Units: pluggable physical-unit system ──────────────────────────────────
export {
  resolveUnit,
  formatUnit,
  IMPERIAL_INCHES,
  METRIC_MM,
  PIXELS,
} from './core/units';
export type { Unit, UnitSystem, UnitValue } from './core/units';

// ─── Affordances: cross-tool hittable chrome (resize/rotate handles) ────────
export {
  composeAffordanceLayer,
  createCornerResizeAffordance,
  createRotationAffordance,
  type Affordance,
  type AffordanceBinding,
  type AffordanceRegion,
  type CornerResizeAffordanceOptions,
  type CornerResizeScratch,
  type CustomPaintContext,
  type RotationAffordanceOptions,
  type RotationScratch,
} from './affordances';
export type { ChromeState } from './core/selection/chromeState';

// ─── Selection overlay: outlines, handles, composer ─────────────────────────
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

// ─── Text rendering / editing ───────────────────────────────────────────────
export * from './features/text';

// ─── Tile / pattern fills ───────────────────────────────────────────────────
export { createTilePattern } from './features/patterns';
export type { TilePatternOpts } from './features/patterns';

// ─── Paint types: FillStyle, Stroke, gradients ──────────────────────────────
export { alignedStrokeRect } from './core/paint-types';
export type {
  FillStyle,
  GradStop,
  Stroke,
  StrokeAlign,
  Region,
} from './core/paint-types';

// ─── Op model: every scene mutation routes through here ─────────────────────
export * from './core/ops';

// ─── Group/parent composition: world pose, rebase, ordered groups ───────────
export {
  composeWorldPose,
  composeRectPose,
  decomposeRectPose,
  rebaseLocalPose,
  translateRectPose,
  worldPoseLookup,
} from './features/groups/composePose';
export type { PoseAdapter } from './features/groups/composePose';
export { nestedHitTester } from './features/groups/nestedHit';
export type {
  NestedHitOpts,
  NestedHitTester,
} from './features/groups/nestedHit';

// ─── Paths: data, builders, hit-tests, boolean ops, pen preview ─────────────
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
  ellipsePath,
  regularPolygonPath,
  starPath,
  linePath,
  boundsOfPath,
  countPathAnchors,
  pointInPath,
  translatePath,
  translatePolygonInPlace,
  scalePathToBounds,
  createPathLayer,
  flattenCubic,
  flattenQuadratic,
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
  DEFAULT_FLATTEN_TOLERANCE,
  composePath,
  decomposePath,
  splitSubpaths,
  unionBoundsPath,
  pathPoseDescriptor,
  pathOriginProjection,
  createPenPreviewLayer,
  pathUnion,
  pathIntersect,
  pathSubtract,
  pathExclude,
  pathDivide,
  pathContainsPoint,
  pathContainsRect,
  pathIntersectsRect,
  pathContainsPolygon,
  pathIntersectsPolygon,
  pathDistanceToPoint,
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
// ─── Utility: 45° axis constraint ───────────────────────────────────────────
export { constrainTo45 } from './util/constrainTo45';

// ─── Groups: lasso-style group records, resolve / expand / unionBounds ──────
export type { Group, GroupAdapter } from './features/groups/types';
export { resolveToOutermostGroup, expandToLeaves } from './features/groups/resolve';
export { unionBounds } from './features/groups/unionBounds';
export type { RectPose } from './features/groups/unionBounds';
export { withGroupOrdering } from './features/groups/orderedGroups';

// ─── Undo history: createHistory + entry shape ──────────────────────────────
export * from './core/history';

// ─── Adapters: contract types + reference arrayAdapter ──────────────────────
export * from './core/adapters/types';
export { arrayAdapter } from './core/adapters/arrayAdapter';
export type { ArrayAdapter, ArrayAdapterConfig } from './core/adapters/arrayAdapter';
export { useArrayAdapter } from './core/adapters/useArrayAdapter';
export type { UseArrayAdapterOptions } from './core/adapters/useArrayAdapter';

// ─── Scene primitive (kit-owned tree of leaves and containers) ──────────────
export { createScene, sceneFromJSON, useScene, asNodeId } from './core/scene';
export type {
  AddNodeSpec,
  ContainerNode,
  LayerRecord,
  LeafNode,
  Node as SceneNode,
  NodeId,
  RegisteredOp,
  Scene,
  SceneRegistry,
  SerializedNode,
  SerializedScene,
  SystemLayerRecord,
  SystemLayerSpec,
  UserLayerRecord,
  UseSceneOptions,
} from './core/scene';
// ─── Gesture/action types (ModifierState, GestureContext, per-action interfaces) ─
export type {
  ModifierState,
  PointerState,
  GestureContext,
  SnapStrategy,
  ActionBehavior,
  BehaviorMoveResult,
  BehaviorResult,
  GroupTransform,
  MoveBehavior,
  MoveOverlay,
  ResizeAnchor,
  ResizePose,
  ResizeProposed,
  ResizeMoveResult,
  BoundsConstraint,
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
  LassoSelectPose,
  LassoSelectProposed,
  LassoSelectMoveResult,
  LassoSelectBehavior,
  LassoSelectOverlay,
  PointSnapFrame,
  PointSnapContext,
  PointSnapResult,
  PointSnapBehavior,
} from './interactions/gestures/types';
export type { ClipboardSnapshot } from './interactions/actions/clipboard/types';

// ─── Gesture specs (Phase 1 of registry unification) ───
export type {
  ModSpec,
  TargetSpec,
  KeySpec,
  KeyHeldSpec,
  WheelSpec,
  ClickSpec,
  DragSpec,
  MultiTouchSpec,
  GestureSpec,
} from './interactions/gestures/spec';

// ─── Snap strategies: grid + guide-line, with pluggable origin projection ───
export {
  snap,
  gridSnapStrategy,
  pointToGridCell,
  RECT_ORIGIN_PROJECTION,
} from './interactions/gestures/shared';
export type { OriginProjection } from './interactions/gestures/shared';
export {
  guideSnapStrategy,
  DEFAULT_GUIDE_TOLERANCE_PX,
} from './interactions/gestures/shared/strategies/guides';
export type { GuideSnapOptions } from './interactions/gestures/shared/strategies/guides';
export { useGuides, createGuidesLayer } from './features/guides';
export type { Guide, UseGuidesReturn, GuidesLayerOpts } from './features/guides';

// ─── Drag-action hooks: move / resize / rotate / insert / area-select / etc. ─
export type { UseMoveOptions } from './interactions/actions/move';
export {
  RECT_POSE_DESCRIPTOR,
  ROTATED_POSE_DESCRIPTOR,
  cornerResizeHandles,
  hitCornerHandle,
  pointSnapToGrid,
} from './interactions/actions/resize';
export type {
  UseResizeOptions,
  PoseProjection,
  CornerHandle,
} from './interactions/actions/resize';
export {
  pointInRotatedRect,
  rotatedRectCorners,
  rectCorners,
  rotatePoint,
  aabbCenter,
  rotationHandle,
  hitRotationHandle,
  DEFAULT_ROTATION_HANDLE_DISTANCE,
} from './interactions/actions/rotate';
export type {
  UseRotateOptions,
  RotateGeometry,
  RotationHandle,
} from './interactions/actions/rotate';
export type { UseInsertOptions } from './interactions/actions/insert';
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
export {
  hitAnchor,
  enumerateAnchors,
  withCoord,
  createAnchorEditOverlayLayer,
} from './interactions/actions/edit-anchors';
export type {
  AnchorHit,
  PathAnchor,
  AnchorEditOverlayOpts,
} from './interactions/actions/edit-anchors';
export type { UseAreaSelectOptions } from './interactions/actions/area-select';
export { selectFromMarquee } from './interactions/actions/area-select/behaviors';
export type { UseLassoSelectOptions } from './interactions/actions/lasso-select';
export {
  selectFromLasso,
  type SelectFromLassoOptions,
} from './interactions/actions/lasso-select/behaviors/selectFromLasso';
// ─── Action hooks: selection-driven keyboard / button actions ───────────────
export {
  useClipboardOps,
} from './interactions/actions/clipboard';
export type {
  UseClipboardOpsOptions,
  UseClipboardOpsReturn,
} from './interactions/actions/clipboard';
export { useAlign, alignDeltaFor, translatePoseViaDescriptor } from './interactions/actions/align';
export type {
  AlignAdapter,
  AlignEdge,
  UseAlignOptions,
  UseAlignReturn,
} from './interactions/actions/align';
export { useDistribute } from './interactions/actions/distribute';
export type {
  DistributeAdapter,
  DistributeAxis,
  DistributeMode,
  UseDistributeOptions,
  UseDistributeReturn,
} from './interactions/actions/distribute';
export { cloneByAltDrag } from './interactions/actions/clone';
export type { ClonePose, CloneLayer, CloneBehavior } from './interactions/gestures/types';
// snapToGrid / snapToContainer / snapBackOrDelete are NOT re-exported at top level —
// import from './move' to disambiguate from resize/insert siblings.

// ─── Reorder: ops ───────────────────────────────────────────────────────────
export {
  createReorderOp,
  createMoveToIndexOp,
  canBringForward,
  canSendBackward,
} from './core/ops/reorder';
export type { ReorderDirection } from './core/ops/reorder';

// ─── Path boolean ops (Pathfinder) ──────────────────────────────────────────
export { useBooleans, applyBooleanOp } from './interactions/actions/booleans';
export type {
  BooleanOp,
  BooleansAdapter,
  BooleanOpResult,
  UseBooleansReturn,
} from './interactions/actions/booleans';

// ─── Debug overlay subsystem (URL-flagged tree-shakeable) ───────────────────
export * from './debug';

// ─── Animation primitives (tween, spring, easings) ──────────────────────────
export * from './animation';

// ─── Layout strategies (snap, point-snap, grid alignment) ───────────────────
export * from './layout';

// ─── Color helpers (parse / normalize / convert) ────────────────────────────
export {
  parseColor,
  parseColorToRgba255,
  normalizeHex,
  hexToRgba,
  rgbaToHex,
} from './renderer/math/color';

// ─── Built-in tool icons ────────────────────────────────────────────────────
// Match the convention used by the Pathfinder panel and Swillustrator
// action-bar icons. Available to any consumer rendering a tool palette
// today; will back `Tool.presentation.icon` defaults once the
// tool-palette spec ships.
export {
  SelectIcon,
  LassoIcon,
  RectIcon,
  EllipseIcon,
  EyedropperIcon,
  LineIcon,
  PolygonIcon,
  StarIcon,
  PencilIcon,
  TextIcon,
  PenIcon,
  HandIcon,
  UnknownIcon,
} from './icons';
export type { IconProps } from './icons';

// ─── Default boolean-op (Pathfinder) icons ──────────────────────────────────
// Shipped with `defaultBooleanActions`; re-exported so consumers that need to
// render an op-shaped glyph outside an `<ActionBar>` (e.g. swillustrator's
// layer-row "produced by" badge) don't have to author their own SVGs or reach
// into a deep path.
export {
  UnionIcon,
  IntersectIcon,
  SubtractIcon,
  ExcludeIcon,
  DivideIcon,
  CropIcon,
} from './interactions/actions/defaults/icons/booleanIcons';

// ─── Trailing type re-exports ────────────────────────────────────────────────
// Types reachable through the public API but previously only importable via
// deep paths. Consolidated here so consumers can name them from the barrel.
export type {
  DrawCommand,
  PathDrawCommand,
  GroupDrawCommand,
  TextDrawCommand,
  ImageDrawCommand,
  ShaderDrawCommand,
  ShaderProgramHandle,
  ShaderUniform,
  Mat3,
} from './renderer';
export type { TextureHandle } from './renderer/textures/registerTexture';
export type {
  LayersMap,
  SceneSlotConfig,
  SelectionOverlaySlotConfig,
  LayerSlotValue,
  StandardSlotConfig,
} from './canvas/Canvas';
export type { BuiltinToolId, ToolBundle } from './canvas/SceneCanvas';
export { BUNDLE_TOOLS, rotateAroundAABBCenter } from './canvas/SceneCanvas';
export { KIT_SHAPE_KINDS } from './canvas/SceneCanvas/useBuiltinShapeTools';
export type {
  SceneToAdapterOptions,
  SceneAdapterSelection,
} from './canvas/sceneAdapter';
export type {
  ToolPresentation,
  DblTapChannel,
} from './tools/types';
export type { ToolHit } from './tools/routing/hitResult';
export type { RouteMatch } from './tools/routing/lookup';
export type { InsertOverlayStyle } from './tools/builtin/marquee';
export type { InsertPoint } from './interactions/gestures/types';
export type { AnimateToBoundsOptions } from './core/viewport/useViewAnimation';
export type {
  UseHandToolOptions,
  InertiaConfig as HandToolInertiaConfig,
} from './tools/builtin/useHandTool/useHandTool';
// UseWheelPanToolOptions and WheelPanInertiaConfig removed (Phase 8.5: useWheelPanTool dissolved).
export type { SelectAdapter } from './tools/builtin/useSelectTool/useSelectTool';
export type { PolygonPoint } from './tools/builtin/usePolygonTool/usePolygonTool';
export type { StarPoint } from './tools/builtin/useStarTool/useStarTool';
export type { UseSceneTrivialOptions } from './core/scene/useScene';
export type {
  DefaultTextData,
  UseSceneTextEditReturn,
} from './features/text/useSceneTextEdit';
export type { SnapPattern } from './layout/strategies/snapPoint';
export type {
  Vec2,
  Rect,
} from './features/paths/polygonHitTestRect';
// `Pt` is the local-only point-shape alias used by `snapPoint`; surface it so
// custom snap behaviors can name the same shape rather than redeclaring it.
export type { Pt } from './layout/strategies/snapPoint';
