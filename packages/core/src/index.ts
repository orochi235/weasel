/**
 * @weasel-js/core — domain-agnostic 2D scene-graph primitives for React +
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
 *     action-specific adapters).
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
 *   import { snapToGrid } from '@weasel-js/core/move';
 *   import { snapToGrid, clampMinSize } from '@weasel-js/core/resize';
 *   import { snapToGrid } from '@weasel-js/core/insert';
 */

// ─── Build identity ─────────────────────────────────────────────────────────
export { VERSION } from './version';

// ─── Features: grids, multi-viewport composition ────────────────────────────
export * from './features/grid';
export * from './features/viewports';
export * from './features/parallax';
export * from './features/simulation';
export * from './features/overlays';

// ─── Stylus input: stylus / coalesced events / pressure ─────────────────────
export {
  getStylusData,
  forEachCoalesced,
  pressureToWidth,
} from './core/stylus/stylus';
export type {
  StylusData,
  PointerSample,
  CoalescedCtx,
  PressureToWidthOptions,
} from './core/stylus/stylus';
export { usePointerStylus } from './core/stylus/usePointerStylus';
export type {
  PointerStylusState,
  UsePointerStylusOptions,
} from './core/stylus/usePointerStylus';

// ─── Viewport: ViewTransform + helpers ──────────────────────────────────────
export * from './core/viewport/viewTransform';
export type { View, ZoomFactor, ZoomBound } from './core/viewport/view';
export { viewToTransform } from './core/viewport/view';
export { meanScale } from './core/viewport/meanScale';
export { pxExtent, scaleDelta, withinPxBox, withinPxRadius } from './core/viewport/pxExtent';
export * from './interactions/gestures/handleDrag';
export * from './interactions/gestures/pointerDrag';
export * from './interactions/gestures/thresholdDrag';
export * from './core/viewport/useCanvasSize';
export {
  COARSE_TARGET_SCALE,
  DEFAULT_DEVICE_PROFILE,
  DeviceProfileProvider,
  HANDLE_BASE_PX,
  ANCHOR_HIT_BASE_PX,
  ROTATION_HANDLE_BASE_PX,
  resolveDeviceProfile,
  useDeviceProfile,
  type DeviceProfile,
  type DeviceProfileProviderProps,
  type DetectedDeviceFacts,
} from './core/device';
export * from './core/viewport/fitToBounds';
export { fitViewToBounds } from './core/viewport/fitViewToBounds';
export type { Bounds, ViewportDims, FitViewToBoundsOptions } from './core/viewport/fitViewToBounds';
export { zoomAt } from './core/viewport/zoomAt';
export type { ZoomClampOpts } from './core/viewport/zoomAt';
export { clampView } from './core/viewport/clampView';
export type { ClampBounds, CanvasSize } from './core/viewport/clampView';
export { sceneNodeClientRect } from './core/viewport/sceneNodeClientRect';
export type { SceneNodeClientRectOpts, NodeClientRect } from './core/viewport/sceneNodeClientRect';
export * from './core/viewport/useZoom';
export * from './core/viewport/useAutoCenter';
// ─── Keybindings: low-level key → action wiring ─────────────────────────────
export { isEditableTarget, matchesKeyBinding } from './interactions/keyHelpers';

// --- @experimental Actions Registry (2026-05-09) ----------------------------
export {
  ActionsProvider, useActionsRegistry, useAction, evaluateEnabled,
  ActionDisabledReason, actionBindings,
} from './interactions/actions/registry';
export type {
  Action, ActionEntry, ActionsProp, ActionsRegistry, ActionEnabledResult,
  UiOngoingControl, BoundGesture,
} from './interactions/actions/registry';
export { actionShortcuts, keySpecShortcut } from './interactions/actions/actionShortcuts';
export type { ActionShortcut } from './interactions/actions/actionShortcuts';
export { moveAction } from './interactions/actions/defaults/move';
export { resizeAction } from './interactions/actions/defaults/resize';
export { rotateAction } from './interactions/actions/defaults/rotate';
export { areaSelectAction } from './interactions/actions/defaults/areaSelect';
export { insertAction } from './interactions/actions/defaults/insert';
export { clearSelectionAction } from './interactions/actions/defaults/clearSelection';
export { cloneAction } from './interactions/actions/defaults/clone';
export { viewportDragPanAction } from './interactions/actions/defaults/viewportDragPan';
export {
  viewportZoomAction,
  makeViewportZoomAction,
  type ViewportZoomOptions,
  type ViewportZoomAnimateOptions,
} from './interactions/actions/defaults/viewportZoom';
export { editAnchorsAction } from './interactions/actions/defaults/editAnchors';
export { lassoSelectAction } from './interactions/actions/defaults/lassoSelect';
export { sliceAction } from './interactions/actions/defaults/slice';
export type { SliceDep } from './interactions/actions/defaults/slice';
export {
  pinchZoomAction,
  makePinchZoomAction,
  type PinchZoomOptions,
} from './interactions/actions/defaults/pinchZoom';
export {
  clipboardCopyAction,
  clipboardCutAction,
} from './interactions/actions/defaults/clipboard';
export type { ClipboardDep } from './interactions/actions/defaults/clipboard';
export { enterTextEditAction } from './interactions/actions/defaults/enterTextEdit';
export type { TextEditDep } from './interactions/actions/defaults/enterTextEdit';
export { useStandardActions } from './interactions/actions/useStandardActions';
export type { UseStandardActionsOptions } from './interactions/actions/useStandardActions';
// Scene-backed op applier for the consumer `applyOps` commit hook — applies a
// default action's committed ops directly to the scene in its native (local)
// frame. Consumers route their own history integration through `applyOps` and
// use this to perform the actual mutation (see DepSchema['applyOps']).
export { defaultCommitAdapter } from './interactions/actions/defaultCommitAdapter';

// ─── Invoker / GestureBinding / ActiveToolContext ───
export { resolveParams } from './interactions/actions/invoker';
export type {
  Point2,
  DragSample,
  InvocationCtx,
  BindingOpts,
  ActionDeps,
  AffordanceHit,
  OngoingHandle,
  OngoingOverlay,
  ImmediateInvoker,
  OngoingInvoker,
  Invoker,
} from './interactions/actions/invoker';
export type { GestureBinding } from './interactions/actions/binding';
export {
  ActiveToolContextProvider,
  ActiveToolContextProviderIfRoot,
  useActiveToolContext,
  useOptionalActiveToolContext,
} from './interactions/actions/activeToolContext';
export type {
  ActiveToolContextValue,
  ActiveToolContextProviderProps,
} from './interactions/actions/activeToolContext';

// ─── Dep registry ───
export {
  DepRegistryProvider,
  useDepRegistry,
  useOptionalDepRegistry,
  useDepSource,
} from './interactions/actions/depRegistry';
export type {
  DepName,
  DepRegistry,
} from './interactions/actions/depRegistry';
// Exported from its defining module rather than through depRegistry's
// re-export, so `DepName = keyof DepSchema` resolves to a documented symbol.
export type { DepSchema } from './interactions/actions/depSchema';
export type {
  AreaSelectDep,
  ClipboardIngestCtx,
  EditAnchorsDep,
  IngestionDep,
  InsertDep,
  SnapDep,
  InsertExtras,
  LassoSelectDep,
  LayoutDep,
  NodeAtPointDep,
  ResizePolicy,
  SvgIngestOptions,
  SvgUnpacker,
  ViewApi,
} from './interactions/actions/depSchema';
export type { GeometryProjection } from './interactions/actions/geometryProjection';
export {
  useResizePolicy,
  type UseResizePolicyOptions,
} from './canvas/deps/resizePolicy';
export { CORNER_ANCHORS, cornerPoint } from './interactions/actions/resize/cornerHandles';
export type { CornerAnchor, CornerEdge } from './interactions/actions/resize/cornerHandles';
export { useSliceDep } from './canvas/deps/slice';

// ─── Gesture dispatcher ───
export {
  useGestureDispatcher,
  createDispatcher,
  // The precedence rule itself, so reflection surfaces can show WHY one
  // binding outranks another instead of re-deriving the tuple.
  specificity,
} from './interactions/dispatcher';
export type {
  Dispatcher,
  DispatcherContext,
  InputEvent,
  BindingScope,
  ScopedBinding,
  MatchResult,
  ResolveOnlyResult,
  ResolvedCandidate,
  ResolveAllOptions,
  UseGestureDispatcherOptions,
} from './interactions/dispatcher';

// ─── Scheduling: the visibility gate every weasel frame loop runs behind ────
export { useVisibleRaf } from './scheduling/useVisibleRaf';
export type { VisibleRaf, VisibleRafOptions, VisibleRafTarget } from './scheduling/useVisibleRaf';

// ─── Viewport: wheel / velocity / decay / pinch / camera animation ──────────
export * from './core/viewport/wheelHandler';
export { clientToCanvas } from './core/viewport/clientToCanvas';
export { useVelocityTracker } from './core/viewport/useVelocityTracker';
export { useDecayLoop } from './core/viewport/useDecayLoop';
export type { DecayLoopConfig, PanBounds } from './core/viewport/useDecayLoop';
export { usePinchGesture } from './core/viewport/usePinchGesture';
export { interpolateView } from './core/viewport/interpolateView';
export { useViewAnimation, VIEW_ANIMATION_KEY } from './core/viewport/useViewAnimation';

// ─── Tools: dispatcher, registry, declarative routing, built-ins ────────────
export * from './tools';
export { usePinchZoomTool, type PinchZoomToolOpts } from './tools/builtin/pinchZoom';
// Route *reflection* — the route grammar, registry, and conflict checker —
// is the `@weasel-js/core/routing` subpath. Tool authoring (`defineTool`,
// `ToolDef`) is on this barrel, via `./tools` above.

// ─── SceneCanvas: the top-level renderer ─────────────────────────────────────
// `Canvas` is intentionally NOT exported — it is `@internal` / `@deprecated`
// (bare `<Canvas>` is not a supported consumer surface). Internal consumers
// import it directly from `./canvas/Canvas`. Its types (`CanvasProps`, slot
// configs, etc.) remain exported below because they form part of SceneCanvas's
// public surface.
export { SceneCanvas, DEFAULT_HANDLE_SIZE } from './canvas/SceneCanvas';
export { defaultDrawOne } from './canvas/defaultDrawOne';
export type { SceneCanvasProps, SceneCanvasHit } from './canvas/SceneCanvas';
export { CursorCoordsHud } from './canvas/CursorCoordsHud';
export type { CursorCoordsHudProps } from './canvas/CursorCoordsHud';
export { PickHud } from './canvas/PickHud';
export type { PickHudProps } from './canvas/PickHud';
export {
  registerNodeShape,
  findNodeShape,
  findShapeSilhouette,
  findShapeInk,
  shapeCoversPoint,
  getNodeShapes,
} from './canvas/NodeShape';
export type {
  NodeShapeEntry,
  NodeInk,
  NodeInkCtx,
  RegisterNodeShapeOptions,
  NodePaintCtx,
  ShapeCoversPointOptions,
} from './canvas/NodeShape';
export {
  getImageBitmap,
  imageStatus,
  subscribeImageReady,
} from './features/images/imageCache';
export type { ImageNodeData, ImageStatus } from './features/images/imageCache';
export { sceneToAdapter, useSceneAdapter } from './canvas/sceneAdapter';
export type { SceneCanvasAdapter } from './canvas/sceneAdapter';
export {
  createNodeRouting,
  type NodeRoutingEntry,
  type NodeRouting,
} from './core/scene/NodeRouting';
export { defaultNodeRouting, inferredNodeRouting } from './canvas/SceneCanvas/defaultNodeRouting';
export { createNodeProperties } from './core/scene/NodeProperties';
export type { NodeProperties, NodePropertiesEntry } from './core/scene/NodeProperties';
export {
  defaultNodeProperties,
  inferredNodeProperties,
  rotationDegreesUnit,
} from './canvas/SceneCanvas/defaultNodeProperties';
export type {
  CanvasProps,
  CanvasHelpers,
  CanvasViewHelpers,
  CanvasSurfaceHelpers,
  CanvasSelectionMode,
  StandardSlotName,
  CustomLayerEntry,
  GridSlotConfig,
} from './canvas/Canvas';
export type { CanvasExtensionApi, SceneCanvasApi } from './canvas/canvasExtension';
// The in-flight gesture seam behind `CanvasHelpers.getGestureBounds()` /
// `subscribeGestures()`. `<SceneCanvas>` wires it from its dispatcher; bare
// `<Canvas>` consumers can supply their own.
export type { GestureSource } from './canvas/gestureBounds';

// ─── External-content ingestion ──────────────────────────────────────────────
// OS file drop / clipboard paste / file picker → content-handler registry.
// `runIngest`, `getContentHandlers`, `kitImageHandler`, and the refcounted
// kit-handler registration are deliberately NOT exported — consumers reach
// the pipeline via `<SceneCanvas ingestion={…}>` and `SceneCanvasApi.ingest`.
export {
  registerContentHandler,
  openFilePicker,
} from './features/ingestion';
export type {
  ContentHandlerEntry,
  IngestCtx,
  IngestItem,
  OpenFilePickerOptions,
} from './features/ingestion';

// ─── Second view on an existing canvas ──────────────────────────────────────
// `<CanvasView>` is a camera over a rect of a `<SceneCanvas>`'s surface, with
// input routed to it — one GL context, N views. Contrast the detached
// canvases below, which each own their own context.
export { CanvasView } from './canvas/CanvasView';
export type { CanvasViewProps, ViewRect } from './canvas/CanvasView';

// ─── Detached scene-view + minimap: read-only canvases with their own GL ─────
// `<SceneViewCanvas>` is a pointer-inert read-only render of a scene at a
// given view; `<MinimapCanvas>` is the opinionated minimap built on top.
// See `docs/superpowers/specs/2026-05-31-detached-minimap-design.md`.
export { SceneViewCanvas } from './canvas/SceneViewCanvas';
export type { SceneViewCanvasProps } from './canvas/SceneViewCanvas';
export { MinimapCanvas } from './canvas/MinimapCanvas';
export type { MinimapCanvasProps } from './canvas/MinimapCanvas';
export {
  buildSceneViewCommands,
  renderSceneToCanvas,
} from './canvas/sceneViewRender';
export type { SceneViewDrawOne, RenderSceneToCanvasArgs } from './canvas/sceneViewRender';
export { renderSceneToPixels, planPixelRender } from './canvas/renderSceneToPixels';
export type {
  RenderSceneToPixelsArgs,
  RasterImage,
  HeadlessCanvasLike,
  PixelRenderPlan,
} from './canvas/renderSceneToPixels';
export {
  FALLBACK_FIT_VIEW,
  computeFitView,
  computeIndicatorCommand,
} from './canvas/minimapMath';
export type {
  ComputeFitViewOptions,
  IndicatorStyle,
  MinimapFit,
} from './canvas/minimapMath';

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
  SelectionContextProviderIfRoot,
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
export { PointerProviderIfRoot } from './canvas/SceneCanvas/PointerProviderIfRoot';
export { ActionsProviderIfRoot } from './canvas/SceneCanvas/ActionsProviderIfRoot';
export { DepRegistryProviderIfRoot } from './canvas/SceneCanvas/DepRegistryProviderIfRoot';

// ─── WeaselProvider: mounts all five kit-root contexts in one wrap ──────────
export { WeaselProvider } from './WeaselProvider';

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
  hitAffordanceRegions,
  annulusSemiAxes,
  createCornerResizeAffordance,
  createRotationAffordance,
  createPathAnchorAffordances,
  PATH_ANCHOR_CHROME_ID,
  type Affordance,
  type AffordanceBinding,
  type AffordanceRegion,
  type AffordanceRegionHit,
  type AnchorScratch,
  type AnchorState,
  type CommonAffordanceScratch,
  type CornerResizeAffordanceOptions,
  type CornerResizeScratch,
  type CustomPaintContext,
  type LayerHit,
  type ClaimableGesture,
  type PathAnchorAffordanceOptions,
  type RotationAffordanceOptions,
  type RotationScratch,
} from './affordances';
export type { ChromeState } from './core/selection/chromeState';

// ─── chrome-caps: declarative chrome-visibility rules ──────────────────────
export {
  cond,
  when,
  and,
  or,
  not,
  always,
  never,
  focused,
  gesturing,
  actionIs,
  selectionEmpty,
  selectionIs,
  selectionAtLeast,
  multiActive,
  hovering,
  hoveringSelected,
  modifierHeld,
  zoomAtLeast,
  canHover,
  coarsePointer,
  modeIs,
  modeIn,
  modeNot,
  capabilityIs,
  capabilityIn,
  capabilityAll,
  capabilityNot,
  evaluate,
  describeRule,
  ALWAYS,
  NEVER,
  buildRuleCtx,
  defaultVisibilityRules,
  resolveVisibility,
  buildChromeCtx,
  useHoverTracking,
} from './features/chrome-caps';
export type {
  ChromeCtx,
  ChromeId,
  Condition,
  VisibilityRules,
  Rule,
  Selector,
  RuleCtx,
  BuildRuleCtxArgs,
  BuildChromeCtxArgs,
  UseHoverTrackingArgs,
} from './features/chrome-caps';

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
// Named rather than `export *`: a star re-export of an external package emits no
// binding in core's bundle, and a consumer importing one of these through
// `@weasel-js/core` fails to resolve it. Caught by `test:smoke:consumer`.
export {
  toRuns,
  runsToPlainText,
  runsToMarkdown,
  markdownToRuns,
  DEFAULT_TEXT_STYLE,
  resolveTextStyle,
  fontString,
  resolveRuns,
  layoutRuns,
  measureText,
  measuredWidth,
  measureTextBounds,
  textLineBoxes,
  verticalAlignOffset,
  createMarkdownRenderer,
  layoutMarkdown,
} from '@weasel-js/text';
export type {
  StyledRun,
  TextStyle,
  TextPaint,
  ResolvedTextStyle,
  ResolvedRun,
  TextPose,
  TextVerticalAlign,
  LayoutRunsOpts,
  LaidOutRuns,
  LaidOutGroup,
  LaidOutQuad,
  LaidOutOutlineGlyph,
  LaidOutDecoration,
  LaidOutLineBox,
  MeasuredText,
  MeasureTextBoundsOpts,
  TextLineBoxesOpts,
  MarkdownFontOptions,
  MeasureFn,
  PositionedRun,
  LayoutLine,
  LayoutResult,
  TextRenderer,
} from '@weasel-js/text';

// ─── Tile / pattern fills ───────────────────────────────────────────────────
export { createTilePattern } from './features/patterns';
export type { TilePatternOpts } from './features/patterns';
export {
  resolvePatternSpec,
  resolveFillPattern,
  isPatternSpec,
} from './features/patterns/resolveSpec';

// ─── Paint types: FillStyle, Stroke, gradients ──────────────────────────────
export {
  alignedStrokeRect,
  dashForStrokeStyle,
  strokeDashStyleOf,
  STROKE_DASH_RATIOS,
} from '@weasel-js/paint';
export { resolveStrokeWidth } from './features/paths/tessellate/stroke';
export type {
  FillStyle,
  GradStop,
  GradientFill,
  GradientKind,
  GradientUnits,
  TilePatternSpec,
  Stroke,
  StrokeAlign,
  StrokeDashStyle,
  Region,
} from '@weasel-js/paint';
export {
  isGradientFill,
  sampleGradientStops,
  withGradientKind,
  gradientGeometry,
  gradientForBounds,
} from './core/gradient';
export { fillInPoseFrame, fillToBoundsFrame } from './core/fillInPoseFrame';
export type { FillPoseBox } from './core/fillInPoseFrame';

// ─── Op model: every scene mutation routes through here ─────────────────────
export * from './core/ops';

// ─── Mixed sentinel: cross-cutting "these values disagree" marker ──────────
export { MIXED } from './core/mixed';
export type { Mixed } from './core/mixed';

// ─── Group/parent composition: world pose, rebase, ordered groups ───────────
export {
  composeWorldPose,
  composeRectPose,
  decomposeRectPose,
  rebaseLocalPose,
  translateRectPose,
  worldPoseLookup,
  IDENTITY_POSE_COMPOSITION,
} from './features/groups/composePose';
export type { PoseAdapter, PoseComposition } from './features/groups/composePose';
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
  pathFromD,
  polygonFromPoints,
  rectPath,
  ellipsePath,
  regularPolygonPath,
  starPath,
  linePath,
  boundsOfPath,
  countPathAnchors,
  pathToAnchors,
  pointInPath,
  translatePath,
  translatePolygonInPlace,
  scalePathToBounds,
  pathInPoseFrame,
  pathInWorld,
  worldEditToStorage,
  poseRotationOf,
  rotatePathAround,
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
  createPathEditingOverlayLayer,
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
  splitPathByLine,
  transformPath,
} from './features/paths';
export type {
  Path,
  PolygonPath,
  RectPath,
  PathFillRule,
  PenAnchor,
  PointInPathOptions,
  CreatePathLayerOpts,
  CreatePenPreviewLayerOptions,
  PenPreviewStyle,
  CreatePathEditingOverlayLayerOptions,
  PathEditingOverlayStyle,
  PathInWorldPose,
  SplitByLineOptions,
  PoseRotation,
} from './features/paths';
// ─── Curves: alternate path representations (Bezier, NURBS, Spiro) ──────────
export {
  bezierCubic,
  bezierQuadratic,
  nurbs,
  spiro,
  CURVE_REPS,
} from './features/paths/curves';
export type {
  SharedAnchor,
  CurveRepKind,
  CurveRepresentation,
  Discriminator,
} from './features/paths/curves';
// ─── Utility: 45° axis constraint ───────────────────────────────────────────
export { constrainTo45 } from './util/constrainTo45';

// ─── Utility: hex8 color helpers ────────────────────────────────────────────
export { toHex8, getAlpha01, withAlpha01, mergeAlphaFromPrev } from './util/color';

// ─── Default paint constants (fill/stroke/palette/ghost) ────────────────────
// ─── Paint kinds: the registry that makes FillStyle open ────────────────────
export {
  registerPaintKind,
  asPaint,
  getPaintKind,
  listPaintKinds,
  paintKindOf,
  _resetPaintKindsForTests,
} from './core/paintKinds';
export type {
  PaintKind,
  PaintKindEntry,
  PaintKindEditorProps,
  PaintBindContext,
  PaintProgram,
} from './core/paintKinds';

export {
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_COLOR,
  DEFAULT_SHAPE_FILL,
  DEFAULT_PALETTE,
  GHOST_STROKE,
  solid,
  strokeOf,
  strokeWith,
  paintAlpha,
  paintWithAlpha,
  paintWithColor,
} from './util/paint';

// ─── Groups: union the bounds of a node set ─────────────────────────────────
export { unionBounds } from './features/groups/unionBounds';
export type { RectPose } from './features/groups/unionBounds';

// ─── Undo history: createHistory + entry shape ──────────────────────────────
// The explicit `createHistory` shadows the engine's own in the star re-export
// below: core's wrapper injects the global op-factory registry as the
// restore-time rebuild hook (see ./core/ops/createHistory).
export { createHistory } from './core/ops/createHistory';
export * from '@weasel-js/history';

// ─── Adapters: contract types + reference arrayAdapter ──────────────────────
export * from './core/adapters/types';
export { arrayAdapter } from './core/adapters/arrayAdapter';
export type { ArrayAdapter, ArrayAdapterConfig } from './core/adapters/arrayAdapter';
export { useArrayAdapter } from './core/adapters/useArrayAdapter';
export type { UseArrayAdapterOptions } from './core/adapters/useArrayAdapter';

// ─── Scene primitive (kit-owned tree of leaves and containers) ──────────────
export { createScene, sceneFromJSON, sceneSelectionStore, useScene, asNodeId } from './core/scene';
export type {
  AddLayerSpec,
  AddNodeSpec,
  ContainerNode,
  LayerRecord,
  LeafNode,
  Node as SceneNode,
  NodeId,
  PoseOverride,
  PoseOverrides,
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

// ─── Gesture specs ───
export type {
  ModSpec,
  TargetSpec,
  KeySpec,
  KeyHeldSpec,
  WheelSpec,
  ClickSpec,
  DragSpec,
  MultiTouchSpec,
  DropSpec,
  PasteSpec,
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
export {
  useGuides,
  createGuidesLayer,
  deriveAlignmentGuides,
  matchAlignment,
  MOVE_ANCHORS,
  RECT_ALIGN_PROJECTION,
  alignMoveBehavior,
  alignInsertBehavior,
  alignResizeBehavior,
} from './features/guides';
export type {
  Guide,
  UseGuidesReturn,
  GuidesLayerOpts,
  AlignBounds,
  AlignAnchor,
  AlignMatchResult,
  AlignBoundsProjection,
  DeriveAlignmentGuidesOptions,
  AlignmentBehaviorBase,
  AlignMoveArgs,
} from './features/guides';

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
export { useDragRadial } from './interactions/gestures/dragRadial';
export type {
  DragRadialPoint,
  DragRadialState,
  DragRadialCtx,
  DragRadialEndCtx,
  UseDragRadialOptions,
  DragRadialController,
} from './interactions/gestures/dragRadial';
export { useHandleDrag } from './interactions/gestures/handleDrag';
export type {
  HandleDragPoint,
  UseHandleDragOptions,
  UseHandleDragReturn,
} from './interactions/gestures/handleDrag';
export { startThresholdDrag } from './interactions/gestures/thresholdDrag';
export type {
  ThresholdDragOptions,
  ThresholdDragHandle,
} from './interactions/gestures/thresholdDrag';
export {
  hitAnchor,
  enumerateAnchors,
  withCoord,
} from './interactions/actions/edit-anchors';
export type {
  AnchorHit,
  PathAnchor,
} from './interactions/actions/edit-anchors';
// ─── Typed scratch keys: shared typed access to ctx.scratch (behaviors) ─────
export {
  scratchKey,
  getScratch,
  setScratch,
  deleteScratch,
  type ScratchKey,
  type ScratchStore,
} from './interactions/scratchKey';
export type { UseLassoSelectOptions } from './interactions/actions/lasso-select';
export {
  selectFromLasso,
  type SelectFromLassoOptions,
} from './interactions/actions/lasso-select/behaviors/selectFromLasso';
// ─── Action hooks: selection-driven keyboard / button actions ───────────────
export {
  useClipboardOps,
  WEASEL_CLIPBOARD_MIME,
  WEASEL_CLIPBOARD_MIME_WEB,
  buildWeaselClipboardText,
  sniffWeaselClipboardText,
  parseWeaselClipboardText,
  embedWeaselMetadataInSvg,
  extractWeaselClipboardFromSvg,
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
export {
  useBooleans,
  useBooleansAdapter,
  applyBooleanOp,
} from './interactions/actions/booleans';
export type {
  BooleanOp,
  BooleansAdapter,
  BooleanOpResult,
  UseBooleansOptions,
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
  resolveColor,
  normalizeHex,
  hexToRgba,
  rgbaToHex,
} from './renderer/math/color';

// ─── Built-in tool icons ────────────────────────────────────────────────────
// Match the convention used by the Pathfinder panel and WeaselDraw
// action-bar icons. Available to any consumer rendering a tool palette
// today; will back `Tool.presentation.icon` defaults once the
// tool-palette spec ships.
export {
  SelectIcon,
  LassoIcon,
  RectIcon,
  EllipseIcon,
  ImageIcon,
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
// render an op-shaped glyph outside an `<ActionBar>` (e.g. WeaselDraw's
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
  ImageMinification,
  SpriteSheet,
} from './renderer';
// Uniform-grid sprite sheet layout: frame index → `ImageDrawCommand.source`.
export { frameRect } from './renderer';
// World-space RenderLayer draw functions wrap their commands in a
// `kind: 'group'` whose transform is `viewToMat3(view)`. Exported here so
// custom layers in consumer code can construct that wrapper without reaching
// into the renderer subpath.
export { viewToMat3 } from './renderer';

// The renderer's 3x3 matrix namespace — the 9-element column-major form
// `resolveSkeleton` hands back, distinct from `@weasel-js/geom`'s 6-element
// affine `Mat3`.
export { mat3 } from './renderer';

// MSDF font registration — consumers register (family, variant, metrics
// JSON URL, atlas PNG URL) at startup so TextDrawCommand can resolve glyphs.
export { registerFont, type FontVariant } from '@weasel-js/font';

// Canvas-sourced dynamic SDF fonts — render any installed machine font with
// no baked atlas (canvas fillText → distance transform → R8 glyph pages).
// Baked MSDF (registerFont) always wins; this is the fallback tier.
export {
  registerCanvasFont,
  isCanvasFont,
  unregisterCanvasFont,
  subscribeGlyphReady,
} from '@weasel-js/font';

// Outline text tier — real glyph geometry, tessellated by the path renderer,
// for text above `OUTLINE_MIN_SCREEN_PX` on screen. Exact at any zoom where a
// distance field is a sampling of one, and a glyph becomes an ordinary path
// so it takes gradient and pattern fills. Purely a rendering upgrade:
// advances and line breaking still come from the SDF tier, so text cannot
// reflow when zoom crosses the threshold. `enableLocalFontOutlines` needs a
// user gesture (and Chromium); everything degrades to SDF without it.
export {
  registerFontOutlines,
  unregisterFontOutlines,
  hasFontOutlines,
  outlineStatus,
  listFontOutlines,
  enableLocalFontOutlines,
  canQueryLocalFonts,
} from '@weasel-js/font';
export type {
  OutlineSource,
  OutlineVariant,
  OutlineStatus,
  OutlineFontStyle,
  LocalFontOutlinesResult,
} from '@weasel-js/font';
export type { TextureHandle } from '@weasel-js/paint';
export type {
  LayersMap,
  SceneSlotConfig,
  SelectionOverlaySlotConfig,
  LayerSlotValue,
  StandardSlotConfig,
} from './canvas/Canvas';
export type { BuiltinToolId, ToolBundle } from './canvas/SceneCanvas';
export { BUNDLE_TOOLS, rotateAroundAABBCenter } from './canvas/SceneCanvas';
export { KIT_SHAPE_KINDS } from './canvas/SceneCanvas/shapeKinds';
export type { BuiltinShapeToolId } from './canvas/SceneCanvas/shapeKinds';
export type { BuiltinToolOptions } from './canvas/SceneCanvas/useBuiltinShapeTools';
export type { ViewportConfig } from './canvas/SceneCanvas/viewportConfig';
export type { InsertNodeFactory } from './canvas/deps';
export type {
  SceneToAdapterOptions,
  SceneAdapterSelection,
} from './canvas/sceneAdapter';
export type {
  ToolPresentation,
} from './tools/types';
export type { Contribution, Eligibility, EligibilityState, OverlayPosition } from './contributions';
export { liveScope, mergeContributions, scopeBindings } from './contributions';
export type { InsertOverlayStyle } from './tools/builtin/marquee';
export type { InsertPoint } from './interactions/gestures/types';
export type {
  AnimateToBoundsOptions,
  ViewAnimationApi,
  ViewAnimationOptions,
  ViewChannel,
} from './core/viewport/useViewAnimation';
export type {
  UseHandToolOptions,
  InertiaConfig as HandToolInertiaConfig,
} from './tools/builtin/hand/useHandTool';
// UseWheelPanToolOptions and WheelPanInertiaConfig removed (useWheelPanTool dissolved).
export type { SelectAdapter } from './tools/builtin/select/useSelectTool';
export type { PolygonPoint } from './tools/builtin/polygon/usePolygonTool';
export type { StarPoint } from './tools/builtin/star/useStarTool';
export type { UseSceneTrivialOptions } from './core/scene/useScene';
export type {
  DefaultTextData,
  UseSceneTextEditReturn,
} from './features/text/useSceneTextEdit';
export type { SnapPattern } from './layout/strategies/snapPoint';
export type {
  Vec2,
  Rect,
} from './core/geometry/polygonHitTestRect';
// `Pt` is the local-only point-shape alias used by `snapPoint`; surface it so
// custom snap behaviors can name the same shape rather than redeclaring it.
export type { Pt } from './layout/strategies/snapPoint';
