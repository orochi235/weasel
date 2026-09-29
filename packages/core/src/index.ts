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
 *     `useAutoCenter`, `zoomAt`,
 *     `wheelHandler`.
 *   - Layer composition: `RenderLayer`, `createChildrenLayer`,
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
 *   - Units: `UnitSystem`, `UnitValue`, `ANGLE_RADIANS`, `IMPERIAL_INCHES`, `METRIC_MM`,
 *     `PIXELS`, `resolveUnit`, `formatUnit`.
 *   - Adapters: `SceneAdapter`, plus narrow per-hook subsets
 *     (`MoveAdapter`, `ResizeAdapter`, `InsertAdapter`, `OrderedAdapter`,
 *     action-specific adapters).
 *
 * Non-rect poses (Path, polygon, custom): the kit is generic over `TPose`.
 * Plug in two small projections so the rect-flavored machinery works on any
 * shape:
 *   - `PoseDescriptor<TPose>` — read AABB + remap on resize. Default
 *     `AUTO_POSE_DESCRIPTOR`, which handles both `{x,y,width,height}` and
 *     `Path`. Pass via `<SceneCanvas poseDescriptor>`.
 *   - `OriginProjection<TPose>` — read snap-origin + translate by delta. Used
 *     by `snap` and `snapBackOrDelete`, and by `@weasel-js/guides`' snap
 *     strategies. All of them default to `AUTO_ORIGIN_PROJECTION`, which reads
 *     rects and `Path`s alike. Pass via `snap(strategy, { origin })` or
 *     `snapBackOrDelete({ ..., origin })`.
 *
 * Placement aids — grids, guides, snapping to them, layout strategies — live
 * in `@weasel-js/guides`, built on the seams here (`SnapStrategy`,
 * `MoveBehavior`, `BoundsConstraint`, `PointSnapBehavior`, `snap`).
 */

// ─── Build identity ─────────────────────────────────────────────────────────
export { VERSION } from './version';

// ─── Features: multi-viewport composition ───────────────────────────────────
export * from './features/viewports';
export * from './features/parallax';
export * from './features/tiling';
export * from './features/simulation';
export * from './features/poseRun';
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
export { viewToTransform, normalizeView, viewZoom } from './core/viewport/view';
export { meanScale } from './core/viewport/meanScale';
export { isPlainObject } from './core/isPlainObject';
export { pxExtent, scaleDelta, screenAngleOf, standoff, withinPxBox, withinPxRadius } from './core/viewport/pxExtent';
export type { Scale2 } from './core/viewport/pxExtent';
export type { ScreenSlop, PickSlop } from './core/viewport/screenSlop';
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
export { DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM, ZOOM_FLOOR, normalizeZoom } from './core/viewport/zoomBounds';
export type { ZoomClampOpts } from './core/viewport/zoomAt';
export { clampView } from './core/viewport/clampView';
export type { ClampBounds, CanvasSize } from './core/viewport/clampView';
export { sceneNodeClientRect } from './core/viewport/sceneNodeClientRect';
export type { SceneNodeClientRectOpts, NodeClientRect } from './core/viewport/sceneNodeClientRect';
export * from './core/viewport/useAutoCenter';
// ─── Keybindings: low-level key → action wiring ─────────────────────────────
export { isEditableTarget, matchesKeyBinding } from '@weasel-js/routing';
export type { KeyBinding } from '@weasel-js/routing';
// ─── Key-state poll: which physical keys are down right now ────────────────
export { createKeyState } from './input/keyState';
export type { KeyState, KeyStateAttachOptions, KeyModifiers } from './input/keyState';
export { useKeyState } from './input/useKeyState';
export type { UseKeyStateOptions } from './input/useKeyState';

// --- @experimental Actions Registry (2026-05-09) ----------------------------
export { ActionsProvider, InputScope, useYoke, Yoke, useActionsRegistry, useAction, useOngoingAction } from '@weasel-js/routing/react';
export { useLatest } from '@weasel-js/react';
export type { OngoingAction } from '@weasel-js/routing/react';
export type { ActionEntry, ActionsProp, ActionsRegistry, UiOngoingControl } from '@weasel-js/routing';
export { ActionDisabledReason } from '@weasel-js/routing';
export type { Action, ActionDispatch, ActionPresentation, ActionVariant } from '@weasel-js/routing';
export { actionBindings, actionItems } from '@weasel-js/routing';
export type { ActionItem } from '@weasel-js/routing';
export type { BoundGesture, BindingSource } from '@weasel-js/routing';
export { evaluateEnabled, buildDepsFromRequires } from '@weasel-js/routing';
export type { ActionEnabledResult } from '@weasel-js/routing';
export { actionShortcuts, keySpecShortcut } from './interactions/actions/actionShortcuts';
export type { ActionShortcut } from './interactions/actions/actionShortcuts';
export { moveAction } from './interactions/actions/defaults/move';
export { resizeAction } from './interactions/actions/defaults/resize';
export { rotateAction } from './interactions/actions/defaults/rotate';
export { areaSelectAction } from './interactions/actions/defaults/areaSelect';
export { insertAction } from './interactions/actions/defaults/insert';
export { clearSelectionAction } from './interactions/actions/defaults/clearSelection';
export { cloneAction } from './interactions/actions/defaults/clone';
export { inPlane, selectionLayer, insertLayer, editingLayer } from './interactions/actions/planeInput';
export type { EditedLayerOf } from './interactions/actions/planeInput';
export { viewportDragPanAction } from './interactions/actions/defaults/viewportDragPan';
export type { DragPanParams } from './interactions/actions/defaults/viewportDragPan';
export {
  viewportZoomAction,
  makeViewportZoomAction,
  type ViewportZoomOptions,
  type ViewportZoomAnimateOptions,
} from './interactions/actions/defaults/viewportZoom';
export {
  viewportWheelPanAction,
  makeViewportWheelPanAction,
  type WheelPanOptions,
} from './interactions/actions/defaults/viewportWheelPan';
export { editAnchorsAction } from './interactions/actions/defaults/editAnchors';
export { lassoSelectAction } from './interactions/actions/defaults/lassoSelect';
export { sliceAction } from './interactions/actions/defaults/slice';
export {
  pinchZoomAction,
  makePinchZoomAction,
  type PinchZoomOptions,
} from './interactions/actions/defaults/pinchZoom';
export {
  clipboardCopyAction,
  clipboardCutAction,
  clipboardPasteAction,
} from './interactions/actions/defaults/clipboard';
export { enterTextEditAction } from './interactions/actions/defaults/enterTextEdit';
export type { SliceDep, ClipboardDep, TextEditDep } from './interactions/actions/depSchema';
export { useStandardActions, KIT_STANDARD_ACTION_IDS } from './interactions/actions/useStandardActions';
export type { UseStandardActionsOptions } from './interactions/actions/useStandardActions';
// Scene-backed op applier for the consumer `applyOps` commit hook — applies a
// default action's committed ops directly to the scene in its native (local)
// frame. Consumers route their own history integration through `applyOps` and
// use this to perform the actual mutation (see DepSchema['applyOps']).
export { defaultCommitAdapter } from './interactions/actions/defaultCommitAdapter';

// ─── Invoker / GestureBinding / ActiveToolContext ───
export { resolveParams } from '@weasel-js/routing';
export type { Point2, DragSample, InvocationCtx, BindingOpts, ActionDeps, AffordanceHit, OngoingHandle, OngoingOverlay, OverlayRole, ImmediateInvoker, OngoingInvoker, Invoker } from '@weasel-js/routing';
export type { GestureBinding } from '@weasel-js/routing';
export { ActiveToolContextProvider, ActiveToolContextProviderIfRoot, useActiveToolContext, useOptionalActiveToolContext } from '@weasel-js/routing/react';
export type { ActiveToolContextValue, ActiveToolContextProviderProps } from '@weasel-js/routing/react';

// ─── Dep registry ───
export { DepRegistryProvider, useDepRegistry, useOptionalDepRegistry, useDepSource } from '@weasel-js/routing/react';
export { createDepRegistry } from '@weasel-js/routing';
export type { DepName, DepRegistry } from '@weasel-js/routing';
// Exported from its defining module rather than through depRegistry's
// re-export, so `DepName = keyof DepSchema` resolves to a documented symbol.
export type { DepSchema } from './interactions/actions/depSchema';
export type {
  AreaSelectDep,
  HitTestView,
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
export { usePoseDescriptorDepSource } from './canvas/deps/poseDescriptor';
export { usePoseCompositionDepSource } from './canvas/deps/poseComposition';
export { CORNER_ANCHORS, cornerPoint } from './interactions/actions/resize/cornerHandles';
export type { CornerAnchor, CornerEdge } from './interactions/actions/resize/cornerHandles';
export { useSliceDep, useSliceDepSource } from './canvas/deps/slice';
export {
  computeSliceOps,
  type ComputeSliceOpsArgs,
  type ComputeSliceResult,
  type SliceableNode,
  type SliceLeaf,
  type SlicePiece,
} from './interactions/actions/defaults/sliceOps';

// ─── Gesture dispatcher ───
export { createDispatcher, // The precedence rule itself, so reflection surfaces can show WHY one
  // binding outranks another instead of re-deriving the tuple.
  specificity } from '@weasel-js/routing';
export { useGestureDispatcher } from '@weasel-js/routing/react';
export type { Dispatcher, DispatcherContext, InputEvent, BindingScope, ScopedBinding, MatchResult, ResolveOnlyResult, ResolvedCandidate, ResolveAllOptions } from '@weasel-js/routing';
export type {
  DispatchRecord, DispatchRecordInput, RecordCandidate, DroppedCandidate,
  RankedCandidate, PlacedBy, WalkStep, SpecificityPart,
} from '@weasel-js/routing';
export type { UseGestureDispatcherOptions, DispatcherChannels } from '@weasel-js/routing/react';

// ─── Scheduling: the visibility gate every weasel frame loop runs behind ────
export { useVisibleRaf } from './scheduling/useVisibleRaf';
export type { VisibleRaf, VisibleRafOptions, VisibleRafTarget } from './scheduling/useVisibleRaf';

// ─── Viewport: wheel / velocity / decay / pinch / camera animation ──────────
export * from './core/viewport/wheelHandler';
export { clientToCanvas } from '@weasel-js/routing';
export { useVelocityTracker } from './core/viewport/useVelocityTracker';
export { createVelocityTracker } from './core/viewport/createVelocityTracker';
export type { VelocityTracker } from './core/viewport/createVelocityTracker';
export { useDecayLoop } from './core/viewport/useDecayLoop';
export type { DecayLoopConfig, PanBounds, InertiaConfig } from './core/viewport/useDecayLoop';
export { interpolateView } from './core/viewport/interpolateView';
export { useViewAnimation, useViewAnimationOn, VIEW_ANIMATION_KEY } from './core/viewport/useViewAnimation';

// ─── Tools: dispatcher, registry, declarative routing, built-ins ────────────
export * from './tools';
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
export { defaultDrawOne, defaultPaintBounds } from './canvas/defaultDrawOne';
export type { PaintBoundsFn } from './canvas/paintCull';
export type { SceneCanvasProps, SceneCanvasHit, SceneCanvasLayers, SceneCanvasLongPress } from './canvas/SceneCanvas';
export { hostAnchorRect, hostAnchorCss } from './canvas/hostAnchor';
export type { HostAnchorInput, HostAnchorAlign, HostAnchorOffset } from './canvas/hostAnchor';
export { useHostAnchor } from './canvas/useHostAnchor';
export type { UseHostAnchorOptions, HostAnchorStyle } from './canvas/useHostAnchor';
export { CursorCoordsHud } from './canvas/CursorCoordsHud';
export type { CursorCoordsHudProps } from './canvas/CursorCoordsHud';
export { PickHud } from './canvas/PickHud';
export type { PickHudProps } from './canvas/PickHud';
export {
  registerNodeShape,
  findNodeShape,
  findShapeSilhouette,
  findShapeInk,
  findShapeBounds,
  DEFAULT_INK,
  shapeCoversPoint,
  getNodeShapes,
} from './canvas/NodeShape';
export type {
  NodeShapeEntry,
  NodeInk,
  NodeInkCtx,
  NodeSilhouetteCtx,
  RegisterNodeShapeOptions,
  NodePaintCtx,
  ShapeCoversPointOptions,
} from './canvas/NodeShape';
export {
  getImageBitmap,
  imageStatus,
  subscribeImageReady,
  isVectorImageSrc,
} from './features/images/imageCache';
export type { ImageNodeData, ImageRasterSize, ImageStatus } from './features/images/imageCache';
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
  StandardSlotName,
  CustomLayerEntry,
} from './canvas/Canvas';
export type { CanvasExtensionApi, CanvasViewHandle, SceneCanvasApi } from './canvas/canvasExtension';
// The in-flight gesture seam behind `CanvasHelpers.getGestureBounds()` /
// `subscribeGestures()`. `<SceneCanvas>` wires it from its dispatcher; bare
// `<Canvas>` consumers can supply their own.
export type { GestureSource, GesturePreviewSource } from './canvas/gestureBounds';
export { resolvePreviews, flattenPreviews } from './interactions/actions/resolvePreviews';
export type { PreviewNode } from './interactions/actions/resolvePreviews';
// The overlay half of the same seam: what an in-flight gesture paints beside
// the scene, resolved to world geometry — every variant of it, with no
// `DrawCommand` and no style, so a renderer that is not core's can read them
// all. `OverlayRole` is the whole of what an action says about appearance.
export { resolveOverlays } from './interactions/actions/resolveOverlays';
export type { ResolvedOverlay, OverlayVisibilityId } from './interactions/actions/resolveOverlays';
export { insertPreviewExtent } from './canvas/insertPreviewExtent';
export type {
  InsertPreviewExtent,
  InsertPreviewGeometry,
  InsertPreviewLike,
  InsertPreviewOverlay,
} from './canvas/insertPreviewExtent';

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
export { SceneViewCanvas } from './canvas/SceneViewCanvas';
export type { SceneViewCanvasProps } from './canvas/SceneViewCanvas';
// `<DrawCanvas>` is the same detached surface with no scene behind it: a
// command list painted onto a canvas of its own.
export { DrawCanvas } from './canvas/DrawCanvas';
export type { DrawCanvasProps, DrawCanvasDraw } from './canvas/DrawCanvas';
export { MinimapCanvas } from './canvas/MinimapCanvas';
export {
  createMinimapContribution,
  createLinkedCursorContribution,
  minimapCenterAction,
  minimapPanAction,
  centerRootOn,
  MINIMAP_CENTER,
  MINIMAP_PAN,
  crosshairRects,
  CROSSHAIR_HALO,
} from './features/minimap';
export type { MinimapContributionOptions, LinkedCursorOptions, CrosshairRect } from './features/minimap';

// ─── Long-press feedback: the pending press as state, and the default ring ──
export { createLongPressStore, LONG_PRESS_MS } from '@weasel-js/routing';
export type { PendingLongPress, LongPressState, LongPressStore, LongPressOptions } from '@weasel-js/routing';
export {
  createLongPressFeedbackContribution, LONG_PRESS_FEEDBACK_ID,
} from './features/longPress/longPressFeedback';
export type { LongPressFeedbackOptions } from './features/longPress/longPressFeedback';
export type { MinimapCanvasProps } from './canvas/MinimapCanvas';
export {
  buildSceneViewCommands,
  renderSceneToCanvas,
} from './canvas/sceneViewRender';
export { releaseCanvasRenderer } from './canvas/canvasRenderer';
export type {
  SceneViewDrawOne, RenderSceneToCanvasArgs, SceneViewLayers, SceneViewCull,
} from './canvas/sceneViewRender';
export { renderSceneToPixels, planPixelRender, createRasterSession, warmRender } from './canvas/renderSceneToPixels';
export { renderNeeds } from './canvas/renderNeeds';
export type { RenderNeeds } from './canvas/renderNeeds';
export type {
  RenderSceneToPixelsArgs,
  WarmRenderOptions,
  RasterSession,
  RasterSessionOptions,
  RasterRenderArgs,
  RasterImage,
  HeadlessCanvasLike,
  PixelRenderPlan,
} from './canvas/renderSceneToPixels';
export { renderDebugSnapshot, debugSnapshotArgs } from './canvas/renderDebugSnapshot';
export type { RenderDebugSnapshotArgs } from './canvas/renderDebugSnapshot';
export { rasterToPng } from './canvas/rasterToPng';
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
  SelectionStore,
} from './core/selection/useSelection';
// --- @experimental Selection ambient context (2026-05-09) -------------------
export {
  SelectionContextProvider,
  SelectionContextProviderIfRoot,
  useSelectionContext,
  usePublishSelection,
} from './features/selection';
export type { SelectionContextValue } from './features/selection';

// --- @experimental Pointer ambient context (2026-05-16) ---------------------
export {
  PointerContextProvider,
  createPointerStore,
  usePointerContext,
  usePointerPosition,
} from './features/pointer/PointerContext';
export type { PointerContextValue, PointerWorldPos } from './features/pointer/PointerContext';
export { PointerProviderIfRoot } from './canvas/SceneCanvas/PointerProviderIfRoot';
export { ActionsProviderIfRoot } from './canvas/SceneCanvas/ActionsProviderIfRoot';
export { DepRegistryProviderIfRoot } from './canvas/SceneCanvas/DepRegistryProviderIfRoot';

// ─── WeaselProvider: mounts all five kit-root contexts in one wrap ──────────
export { WeaselProvider } from './WeaselProvider';
export type { WeaselProviderProps } from './WeaselProvider';

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
export { workspaceTintLayer, modeDecorationLayer } from './features/modes/modeLayers';
export type { WorkspaceTintLayerOptions } from './features/modes/modeLayers';
export { createChildrenLayer } from './features/groups/children';
export type { CreateChildrenLayerOpts } from './features/groups/children';

// ─── Units: pluggable physical-unit system ──────────────────────────────────
export {
  resolveUnit,
  formatUnit,
  unitScale,
  ANGLE_RADIANS,
  IMPERIAL_INCHES,
  METRIC_MM,
  PIXELS,
} from '@weasel-js/quantity';
export type { Unit, UnitEntry, UnitScale, UnitSystem, UnitValue } from '@weasel-js/quantity';

// ─── Affordances: cross-tool hittable chrome (resize/rotate handles) ────────
export {
  composeAffordanceLayer,
  hitAffordanceRegions,
  annulusSemiAxes,
  pointRegionFrame,
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
  type PathAnchorAffordanceOptions,
  type RotationAffordanceOptions,
  type RotationScratch,
} from './affordances';
export type { ClaimableGesture } from '@weasel-js/gestures';
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
  DEFAULT_ALLOWED_CAPABILITIES,
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
} from './features/selection';
export type {
  ComposeSelectionPoseOpts,
  SelectionOutlineLayerOpts,
  SelectionHandlesLayerOpts,
  SelectionOverlayLayerOpts,
  SelectionHandleStyle,
} from './features/selection';

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
  MARKDOWN_RUN_GRAMMAR,
  DEFAULT_TEXT_STYLE,
  resolveTextStyle,
  resolveAlign,
  fontString,
  resolveRuns,
  resolveRunFace,
  SCRIPT_METRICS,
  scriptMetrics,
  scriptMetricsFor,
  DEFAULT_DECORATION_METRICS,
  decorationMetrics,
  numericWeight,
  isBoldWeight,
  transformRunTexts,
  SMALL_CAPS_SCALE,
  smallCapsScale,
  smallCapsScaleFor,
  smallCapsText,
  isSmallCapsLetter,
  layoutRuns,
  cachedLayoutRuns,
  layoutTextPose,
  textPoseLayoutInput,
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
  RunGrammar,
  RunMarker,
  RunFlag,
  TextStyle,
  TextAlign,
  TextDirection,
  TextPaint,
  ResolvedTextStyle,
  ResolvedRun,
  ScriptPreset,
  DecorationKind,
  FaceMetricsFn,
  TextTransform,
  FontVariantCaps,
  SmallCapsText,
  RunSourceMap,
  TransformedRunText,
  TextPose,
  TextVerticalAlign,
  LayoutRunsOpts,
  TextPoseLayout,
  TextPoseLayoutInput,
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

// Mesh gradients live on `@weasel-js/core/mesh`, off the root barrel.
export {
  resolvePatternSpec,
  resolveFillPattern,
  isPatternSpec,
} from './features/patterns/resolveSpec';

// ─── Paint types: FillStyle, Stroke, gradients ──────────────────────────────
export {
  alignedStrokeRect,
  composePatternTransform,
  contrastLineColor,
  dashForStrokeStyle,
  decomposePatternTransform,
  resolveScreenLength,
  strokeDashStyleOf,
  STROKE_DASH_RATIOS,
} from '@weasel-js/paint';
export { resolveStrokeWidth } from './features/paths/tessellate/stroke';
export type {
  ColorSpace,
  FillStyle,
  GradStop,
  GradientFill,
  GradientKind,
  GradientUnits,
  TilePatternSpec,
  PatternTransform,
  PatternTransformParts,
  Stroke,
  StrokeAlign,
  StrokeDashStyle,
  Region,
  KitMarkerKey,
  MarkerKey,
  MarkerRef,
  ScreenLength,
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
  composeRigidPose,
  decomposeRigidPose,
  rebaseLocalPose,
  translateRectPose,
  worldPoseLookup,
  IDENTITY_POSE_COMPOSITION,
  RECT_POSE_COMPOSITION,
  RIGID_POSE_COMPOSITION,
} from './features/groups/composePose';
export type { PoseAdapter, PoseComposition, PoseClosure } from './features/groups/composePose';
export { nestedHitTester } from './features/groups/nestedHit';
export { unionOfChildrenVia } from './features/groups/unionOfChildren';
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
  pathCommandCoordCount,
  PathBuilder,
  pathFromD,
  polygonFromPoints,
  polylineFromPoints,
  rectPath,
  ellipsePath,
  regularPolygonPath,
  starPath,
  linePath,
  circlePath,
  squarePath,
  rectMarkerPath,
  roundRectPath,
  boundsOfPath,
  countPathAnchors,
  pathToAnchors,
  pointInPath,
  translatePath,
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
  pathSignedArea,
  reversePath,
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
  pointAlongPath,
  splitPathBySegment,
  splitPathByPolyline,
  snipPathByPolyline,
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
  PathStation,
  PointAlongPathOptions,
  SplitBySegmentOptions,
  PoseRotation,
} from './features/paths';
// ─── Curves: alternate path representations (Bezier, NURBS, Spiro) ──────────
export {
  bezierCubic,
  bezierQuadratic,
  nurbs,
  spiro,
  CURVE_REPS,
} from '@weasel-js/geom/curves';
export type {
  SharedAnchor,
  CurveRepKind,
  CurveRepresentation,
  Discriminator,
} from '@weasel-js/geom/curves';
// ─── Utility: 45° axis constraint ───────────────────────────────────────────
export { constrainTo45 } from './util/constrainTo45';

// ─── Utility: hex8 color helpers ────────────────────────────────────────────
export { toHex8, getAlpha01, withAlpha01, mergeAlphaFromPrev } from './util/color';

// ─── Default paint constants (fill/stroke/palette/ghost) ────────────────────
// ─── Paint kinds: the registry that makes FillStyle open ────────────────────
export {
  registerPaintKind,
  registerPaintKindLoader,
  warmPaintKinds,
  isPaintKindKnown,
  asPaint,
  getPaintKind,
  listGradientKinds,
  listPaintKinds,
  paintKindOf,
  switchGradientKind,
  paintKindRegistry,
} from './core/paintKinds';
export { usePaintKinds, useGradientKinds, usePaintKind } from './core/usePaintKinds';
export type {
  PaintKind,
  PaintKindEntry,
  PaintKindEditorProps,
  PaintKindLoader,
  PaintBindContext,
  PaintProgram,
  PaintResources,
} from './core/paintKinds';
export type { ProgramSource } from './renderer/shaders/registerProgram';
export type { ShaderProgram } from './renderer/shaders/ShaderProgram';

export {
  registerMarker, getMarker, listMarkers, markerRegistry,
} from './core/strokeMarkers';
export type { MarkerEntry, MarkerCtx, MarkerPaint } from './core/strokeMarkers';
export { markerInset, markerKeyOf, resolveMarkerSize, strokeInsets } from './core/markerInset';
export { markerSites } from './features/paths/markerSites';
export type { MarkerSite, MarkerSiteRequest } from './features/paths/markerSites';
export { BUILTIN_MARKERS } from './core/strokeMarkerShapes';
export { trimPolyline } from '@weasel-js/geom/tessellate';
export type { Polyline } from '@weasel-js/geom/tessellate';

export {
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_COLOR,
  DEFAULT_SHAPE_FILL,
  DEFAULT_PALETTE,
  cycleFill,
  GHOST_STROKE,
  solid,
  strokeOf,
  strokeWith,
  paintAlpha,
  paintWithAlpha,
  paintWithColor,
} from './util/paint';

// ─── Groups: union the bounds of a node set ─────────────────────────────────
export { unionBounds, unionAABB, axisAlignedBounds } from './core/geometry/unionBounds';
export type { RectPose } from './core/geometry/unionBounds';

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
export {
  createScene, sceneFromJSON, sceneSelectionStore, useScene, asNodeId,
  createPoseFeed, createPoseOverrides, definesFrame, derivedDepOf, derivedPose, documentPose, effectivePose,
  UNION_OF_CHILDREN, unionOfChildren, SceneArrivalRefused,
} from './core/scene';
export type { PoseSource, PosedNode } from './core/scene';
export type {
  AddLayerSpec,
  AddNodeSpec,
  DerivedDep,
  DerivePathFn,
  DerivePoseFn,
  ContainerNode,
  FeedDelta,
  FeedNode,
  LayerRecord,
  LayoutFrame,
  LayoutMove,
  LeafNode,
  Node as SceneNode,
  NodeId,
  PoseFeed,
  PoseOverride,
  PoseOverrides,
  RegisteredOp,
  Scene,
  SceneArrivalHandler,
  SceneRegistry,
  SerializedLayer,
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
  BehaviorEnd,
} from './interactions/gestures/types';
export type { ClipboardSnapshot } from './interactions/actions/clipboard/types';

// ─── Gesture specs ───
export type {
  ModSpec,
  TargetSpec,
  KeySpec,
  KeyHeldSpec,
  WheelSpec,
  PinchSpec,
  ClickSpec,
  DragSpec,
  MultiTouchSpec,
  DropSpec,
  PasteSpec,
  GestureSpec,
} from './interactions/gestures/spec';

// ─── Snapping seam: `snap` wraps a SnapStrategy as a MoveBehavior; an origin
// projection says how a pose is read and moved. The strategies themselves
// (grid, guides) are in @weasel-js/guides.
export {
  snap,
  AUTO_ORIGIN_PROJECTION,
  RECT_ORIGIN_PROJECTION,
  screenTolerance,
  gestureViewReader,
  gesturePlaneReader,
} from './interactions/gestures/shared';
export type { OriginProjection } from './interactions/gestures/shared';

// ─── Drag-action hooks: move / resize / rotate / insert / area-select / etc. ─
export type { UseMoveOptions } from './interactions/actions/move';
export {
  AUTO_POSE_DESCRIPTOR,
  isPathLike,
  isRectPose,
  RECT_POSE_DESCRIPTOR,
  ROTATED_POSE_DESCRIPTOR,
  poseDescriptorForNode,
  cornerResizeHandles,
  fixedCornerOf,
  hitCornerHandle,
} from './interactions/actions/resize';
export type {
  UseResizeOptions,
  PoseDescriptor,
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
  RotationHandle,
} from './interactions/actions/rotate';
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
export { openPointerSession, DRAG_THRESHOLD_PX, pastDragThreshold } from '@weasel-js/routing';
export type { PointerSession, PointerSessionCallbacks, PointerSessionCancelReason, PointerSessionOptions } from '@weasel-js/routing';
export { useHandleDrag } from './interactions/gestures/handleDrag';
export type {
  HandleDragPoint,
  HandleDragEnd,
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
export { scratchKey, getScratch, setScratch, deleteScratch, type ScratchKey, type ScratchStore } from '@weasel-js/routing';
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
  ClipboardFlavors,
  UseClipboardOpsOptions,
  UseClipboardOpsReturn,
} from './interactions/actions/clipboard';
export {
  useAlign,
  alignDeltaFor,
  alignTargetBounds,
  translatePoseViaDescriptor,
  visualBoundsViaDescriptor,
} from './interactions/actions/align';
export { resolveSpatialReference } from './interactions/actions/spatialReference';
export type { SpatialReference, SpatialReferenceSources } from './interactions/actions/spatialReference';
export type { FlipAxis, FlipPivot } from './interactions/actions/flip/helpers';
export type {
  AlignAdapter,
  AlignEdge,
  AlignReference,
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
// snapToContainer / snapBackOrDelete are NOT re-exported at top level —
// import them from '@weasel-js/core/move'.

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

// ─── Create Outlines: text nodes to path geometry ───────────────────────────
export {
  applyCreateOutlines,
  useCreateOutlinesAdapter,
} from './interactions/actions/outlines';
export type {
  CreateOutlinesAdapter,
  CreateOutlinesResult,
  OutlinePathSpec,
} from './interactions/actions/outlines';

// ─── Debug overlay subsystem (URL-flagged tree-shakeable) ───────────────────
export * from './debug';

// ─── Animation primitives (tween, spring, easings) ──────────────────────────
export * from './animation';

// ─── Layout: the contract a container's layout strategy implements. The
// strategies themselves (freeform, tileGrid, snapPoint) are in @weasel-js/guides.
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
  ArrowIcon,
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
export { CreateOutlinesIcon } from './interactions/actions/defaults/icons/outlineIcons';

// ─── Default edit-action icons ──────────────────────────────────────────────
// Shipped on the clipboard, duplicate, group, reorder and flip actions.
export {
  CutIcon,
  CopyIcon,
  PasteIcon,
  DuplicateIcon,
  GroupIcon,
  UngroupIcon,
  BringForwardIcon,
  BringToFrontIcon,
  SendBackwardIcon,
  SendToBackIcon,
  FlipXIcon,
  FlipYIcon,
} from './interactions/actions/defaults/icons/editIcons';
// ─── Default align and distribute icons ─────────────────────────────────────
export {
  AlignLeftIcon,
  AlignCenterXIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignCenterYIcon,
  AlignBottomIcon,
} from './interactions/actions/defaults/icons/alignIcons';
export {
  DistributeHorizontalIcon,
  DistributeVerticalIcon,
} from './interactions/actions/defaults/icons/distributeIcons';
// Undo, redo and delete; drawn in @weasel-js/ui's icon pipeline, which emits
// their markup here and re-exports these components.
export {
  UndoIcon,
  RedoIcon,
  DeleteIcon,
  type ActionGlyphProps,
} from './interactions/actions/defaults/icons/actionGlyphIcons';
export { ACTION_GLYPHS } from './interactions/actions/defaults/icons/actionGlyphs';

// ─── Trailing type re-exports ────────────────────────────────────────────────
// Types reachable through the public API but previously only importable via
// deep paths. Consolidated here so consumers can name them from the barrel.
export type {
  DrawCommand,
  PathDrawCommand,
  GroupDrawCommand,
  TextDrawCommand,
  ImageDrawCommand,
  SpritesDrawCommand,
  ShaderDrawCommand,
  ShaderProgramHandle,
  ShaderUniform,
  Effect,
  GlMat3,
  ImageMinification,
  SpriteSheet,
  RenderTarget,
} from './renderer';
// Uniform-grid sprite sheet layout: frame index → `ImageDrawCommand.source`.
export { frameRect } from './renderer';
// Floats per sprite in a `SpritesDrawCommand.sprites` array — a consumer
// cannot pack one without it.
export { SPRITE_STRIDE } from './renderer';
// Full-screen effect passes. Here rather than only on the `/renderer` subpath
// because `RenderLayer.effects` is on this barrel, and a consumer typing that
// field should not have to reach past it for the values that go in it.
export { blur, vignette, registerEffect } from './renderer';
// World-space RenderLayer draw functions wrap their commands in a
// `kind: 'group'` whose transform is `viewToMat3(view)`. Exported here so
// custom layers in consumer code can construct that wrapper without reaching
// into the renderer subpath.
export { viewToMat3 } from './renderer';

// Drops the commands that cannot reach a screen rectangle — what the scene
// slot's `cull` option runs, for a custom layer to run over its own output.
export { cullDrawCommands, type CullRect } from './renderer';

// The renderer's 3x3 matrix namespace, operating on `GlMat3` — the 9-element
// column-major `Float32Array` a GL uniform upload wants. `mat3.toAffine` and
// `mat3.fromAffine` convert to and from `@weasel-js/geom`'s 6-element `Mat3`,
// which is what an `SvgGroupNode.transform` already is.
export { mat3 } from './renderer';

// MSDF font registration — consumers register (family, variant, metrics
// JSON URL, atlas PNG URL) at startup so TextDrawCommand can resolve glyphs.
export { registerFont, warmFonts, type FontVariant, type FontRequest, type RegisterFontOptions } from '@weasel-js/font';

// Canvas-sourced dynamic SDF fonts — render any installed machine font with
// no baked atlas (canvas fillText → distance transform → R8 glyph pages).
// Baked MSDF (registerFont) always wins; this is the fallback tier.
export {
  registerCanvasFont,
  isCanvasFont,
  unregisterCanvasFont,
  subscribeGlyphReady,
} from '@weasel-js/font';

// The CSS font-family that sets DOM text in the face the canvas draws for a
// family — from its registered font file when the canvas draws an atlas.
export { cssFontFamily, cssFontFamilyLoading } from '@weasel-js/font';

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
  loadFontOutlines,
  listFontOutlines,
  fontRegistry,
  fontOutlineRegistry,
  enableLocalFontOutlines,
  canQueryLocalFonts,
} from '@weasel-js/font';
export type {
  FontFamilyFaces,
  OutlineFaceInfo,
  OutlineSource,
  OutlineVariant,
  OutlineStatus,
  FontStyle,
  LocalFontOutlinesResult,
  FaceMetrics,
  FaceRuleMetrics,
  FaceScriptMetrics,
} from '@weasel-js/font';
export type { TextureHandle } from '@weasel-js/paint';

// Custom tool cursors. `Tool.cursor`, `Action.cursor`, `Action.activeCursor`
// and `AffordanceRegion.cursor` all take a `CursorSpec`, so the type and the
// baker reach consumers from here rather than through a second import.
// Named, not `export *` — a star re-export of an external package survives
// typecheck and emits no binding in the bundle.
export {
  cursorFor, resolveCursor, resolveCursorTier, bakeCursor, CURSOR_ANGLE_STEPS, CURSOR_MAX_CSS_PX,
} from '@weasel-js/cursor';
export type {
  CursorSpec,
  CursorGlyphSpec,
  CursorGlyphName,
  CursorGlyph,
  ResolvedCursor,
  BakeOptions,
} from '@weasel-js/cursor';
export { createPaintedCursorState } from '@weasel-js/cursor';
export type {
  PaintedCursor,
  PaintedCursorFrame,
  PaintedCursorState,
} from '@weasel-js/cursor';
export { createPaintedCursorLayer, PAINTED_CURSOR_LAYER_ID } from './features/cursor/paintedCursorLayer';
export type {
  LayersMap,
  SceneSlotConfig,
  SelectionOverlaySlotConfig,
  LayerSlotValue,
  StandardSlotConfig,
} from './canvas/Canvas';
export type { BuiltinToolId, Feature } from './canvas/SceneCanvas';
export type { BaseFeature } from './canvas/SceneCanvas/features';
export { BUILTIN_TOOL_IDS, SCENE_CANVAS_FEATURES, rotateAroundAABBCenter } from './canvas/SceneCanvas';
export { FEATURE_ACTION_IDS, TOOL_DRIVEN_ACTION_IDS } from './canvas/SceneCanvas/features';
export { KIT_SHAPE_KINDS, SHAPE_KINDS } from './core/shapeKinds';
export type {
  BuiltinShapeToolId, KitInsertShape, ShapeKind, ShapeKindDescriptor, ShapeKindsWhere,
} from './core/shapeKinds';
export type { BuiltinToolOptions } from './canvas/SceneCanvas/useBuiltinShapeTools';
export type { InsertNodeFactory } from './canvas/deps';
export type {
  SceneToAdapterOptions,
  SceneAdapterSelection,
} from './canvas/sceneAdapter';
export type { ContributionRouting, Eligibility, EligibilityState, HotkeyTrigger, OverlayPosition, ToolPresentation } from '@weasel-js/routing';
export type { Contribution, ContributionChrome } from './tools/overlayBinding';
export type { ContributionDeps } from '@weasel-js/routing';
export { liveScope, scopeBindings, modeShortcuts, modeShortcutSpec } from '@weasel-js/routing';
export type { ModeShortcutHandlers } from '@weasel-js/routing';
export { mergeContributions } from './canvas/surfaceContribution';
export type { SurfaceContribution, ContributionDepReader } from './canvas/surfaceContribution';
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
export type { StyleToggle } from './features/text/useTextEdit';
export type { Vec2 } from './core/geometry/vec2';
export type { Rect } from '@weasel-js/geom';

// The read-only surface each kit registry hands out (`paintKindRegistry`,
// `markerRegistry`, `fontRegistry`, …), and the store behind it.
export { createReflectable } from '@weasel-js/registry';
export type {
  Reflectable,
  Reflection,
  ReflectedEntry,
  Registrant,
  RegisterOptions,
} from '@weasel-js/registry';
