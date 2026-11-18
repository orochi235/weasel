/**
 * Part of the `@weasel-js/core` barrel. SceneCanvas, ingestion, layers, and the kit-root provider.
 *
 * @packageDocumentation
 */

// ─── SceneCanvas: the top-level renderer ─────────────────────────────────────
// `Canvas` is `@internal` and not exported. Its types (`CanvasProps`, slot
// configs) are, because they are part of SceneCanvas's public surface.
export { SceneCanvas, DEFAULT_HANDLE_SIZE } from '../canvas/SceneCanvas';
export { CANVAS_CONTEXT_ATTRIBUTES } from '../canvas/contextAttributes';
export { readCanvasPixels } from '../canvas/readCanvasPixels';
export { createCanvasReader, readGl, regionAround, regionOnCanvas, type CanvasReader } from '../canvas/readback';
export { OVERLAY_ROLE_STROKES } from '../canvas/overlayRoleStrokes';
export {
  AmbientContributionsProvider, type AmbientContributionsProviderProps, useProvidedAmbient,
} from '../canvas/ambientContributions';
export { defaultDrawOne, defaultPaintBounds } from '../canvas/defaultDrawOne';
export { overChildren, isOverChildren, splitOverChildren } from '../canvas/overChildren';
export type { PaintBoundsFn } from '../canvas/paintCull';
export type { SceneCanvasProps, SceneCanvasHit, SceneCanvasLayers, SceneCanvasLongPress } from '../canvas/SceneCanvas';
export type { SceneCanvasActionProps } from '../canvas/SceneCanvas/actionProps';
export type { SceneCanvasPointerProps } from '../canvas/SceneCanvas/pointerProps';
export type { SceneCanvasToolProps } from '../canvas/SceneCanvas/toolProps';
export type { SceneCanvasSampleProps } from '../canvas/SceneCanvas/sampleProps';
export type { PagePaintedScene, SceneCanvasPaintedBy, WorkerPaintedScene, WorkerSceneSlot } from '../canvas/SceneCanvas/workerProps';
export type { SceneCanvasGeometry } from '../canvas/SceneCanvas/geometryProps';
export type { SceneCanvasIngestion } from '../canvas/SceneCanvas/ingestionProps';
export type { SceneCanvasSceneProps } from '../canvas/SceneCanvas/sceneProps';
export type { SceneCanvasSelectTool } from '../canvas/SceneCanvas/selectToolProps';
export type { SceneCanvasViewport } from '../canvas/SceneCanvas/viewportProp';
export type { EdgePanOptions } from '../canvas/SceneCanvas/useEdgePan';
export { DEFAULT_CONTENT_MARGIN, type ContentViewBounds, type SceneCameraProps } from '../canvas/SceneCanvas/sceneViewBounds';
export type { PathEditHost, PathEditOpening } from '../canvas/SceneCanvas/pathEditHost';
export { hostAnchorRect, hostAnchorCss } from '../canvas/hostAnchor';
export type { HostAnchorInput, HostAnchorAlign, HostAnchorOffset } from '../canvas/hostAnchor';
export { useHostAnchor } from '../canvas/useHostAnchor';
export type { UseHostAnchorOptions, HostAnchorStyle } from '../canvas/useHostAnchor';
export { CursorCoordsHud } from '../canvas/CursorCoordsHud';
export type { CursorCoordsHudProps } from '../canvas/CursorCoordsHud';
export { PickHud } from '../canvas/PickHud';
export { clipOutline } from '../canvas/ownClip';
export type { PickHudProps } from '../canvas/PickHud';
export {
  registerNodeShape,
  refreshNodeShapes,
  findNodeShape,
  findShapeSilhouette,
  findShapeInk,
  findShapeBounds,
  DEFAULT_INK,
  shapeCoversPoint,
  nodeShapeEntries,
  createNodeShapes,
  defaultNodeShapes,
  nodeShapesOf,
} from '../canvas/NodeShape';
export type {
  NodeShapeEntry,
  NodeInk,
  NodeInkCtx,
  NodeSilhouetteCtx,
  RegisterNodeShapeOptions,
  NodeShapes,
  NodePaintCtx,
  InheritedPaint,
  ShapeCoversPointOptions,
} from '../canvas/NodeShape';
// A node kind's outline as paths, and the generation its geometry moves on.
export { NodeOutlineError, findNodeOutline, sceneNodeOutline, geometryGenerationOf } from '../canvas/nodeOutline';
export type { NodeOutline, NodeOutlineCtx, PaintedPath } from '../canvas/nodeOutline';
export { drawnBoundsOf, drawnAabbOf, inkExtentsOf, findShapeDrawnBounds } from '../canvas/drawnBounds';
export { inheritedPaintIn, paintAbove, withInheritedPaintBounds, withInheritedPaints } from '../canvas/inheritedPaints';
export { inheritedPaintOf, inheritsPaint, withInheritedPaint } from '../core/scene/inheritedPaint';
export type { ResolvedPaintFields } from '../core/scene/inheritedPaint';
export type { DrawnBoundsOptions, DrawnBoundsScene } from '../canvas/drawnBounds';
export { drawnBoundsScene } from '../canvas/derivedPath';
export { sceneContentBounds } from '../canvas/contentBounds';
export type { InkExtents } from '../core/geometry/inkExtents';
export {
  bitmapSrc,
  getImageBitmap,
  holdImageBitmaps,
  imageStatus,
  isBitmapSrc,
  subscribeImageReady,
  isVectorImageSrc,
  releaseImage,
  setImageCacheBudget,
  retryImage,
} from '@weasel-js/renderer';
export type { ImageNodeData, ImageRasterSize, ImageStatus } from '@weasel-js/renderer';
export { sceneToAdapter } from '../canvas/sceneAdapter';
export { useSceneAdapter } from '../canvas/useSceneAdapter';
export type { SceneCanvasAdapter } from '../canvas/sceneAdapter';
export {
  createNodeRouting,
  routeKind,
  type NodeRoutingEntry,
  type NodeRouting,
  type RoutedNode,
} from '../core/scene/NodeRouting';
export { booleanGroupRouting, defaultNodeRouting, groupNodeRouting, inferredNodeRouting } from '../canvas/SceneCanvas/defaultNodeRouting';
export { createNodeProperties } from '../core/scene/NodeProperties';
export { minSizeOf, type MinSize } from '../core/scene/minSize';
export type { NodeProperties, NodePropertiesEntry } from '../core/scene/NodeProperties';
export {
  defaultNodeProperties,
  inferredNodeProperties,
  rotationDegreesUnit,
  shapePropertiesSchema,
  type ShapePropertiesExtras,
} from '../canvas/SceneCanvas/defaultNodeProperties';
export { registerPaintStandIn, type KeepPaint, type PaintStandIn } from '../canvas/paintStandIns';
export type { CanvasProps, CanvasRetainOptions } from '../canvas/Canvas';
export type { CanvasWorkerSurface } from '../canvas/renderWorker/workerStack';
export { canvasPaintsWith, type CanvasBackend } from '../canvas/canvasBackend';
export { CanvasBackendProvider } from '../canvas/canvasBackendContext';
export type { ViewPoseAdapter } from '../canvas/useViewHelpers';
export type { CameraProps, CanvasViewState } from '../canvas/useCanvasView';
export type { CanvasHelpers, CanvasViewHelpers, CanvasSurfaceHelpers } from '../canvas/useViewHelpers';
export type { StandardSlotName, CustomLayerEntry } from '../canvas/layerSlots';
export type { CanvasExtensionApi, CanvasIdReadOptions, CanvasViewHandle, SceneCanvasApi, ViewAt } from '../canvas/canvasExtension';
// The in-flight gesture seam behind `CanvasHelpers.getGestureBounds()` /
// `subscribeGestures()`. `<SceneCanvas>` wires it from its dispatcher; bare
// `<Canvas>` consumers can supply their own.
export type { GestureSource, GesturePreviewSource } from '../canvas/gestureBounds';
export { resolvePreviews, flattenPreviews } from '../interactions/actions/resolvePreviews';
export type { PreviewNode } from '../interactions/actions/resolvePreviews';
export { publishPreviews } from '../canvas/publishPreviews';
// The overlay half of the same seam: what an in-flight gesture paints beside
// the scene, resolved to world geometry — every variant of it, with no
// `DrawCommand` and no style, so a renderer that is not core's can read them
// all. `OverlayRole` is the whole of what an action says about appearance.
export { createPathOverlay, PATH_OVERLAY_ROLES } from '../canvas/pathOverlay';
export type { PathOverlay, PathOverlayOptions, PathOverlayStyle, TransientPath } from '../canvas/pathOverlay';
export { resolveOverlays } from '../interactions/actions/resolveOverlays';
export type { ResolvedOverlay, OverlayVisibilityId } from '../interactions/actions/resolveOverlays';
export { insertPreviewExtent } from '../canvas/insertPreviewExtent';
export type {
  InsertPreviewExtent,
  InsertPreviewGeometry,
  InsertPreviewLike,
  InsertPreviewOverlay,
} from '../canvas/insertPreviewExtent';

// ─── External-content ingestion ──────────────────────────────────────────────
// OS file drop / clipboard paste / file picker → content-handler registry.
// `getContentHandlers` is deliberately NOT exported — consumers reach the
// pipeline via `<SceneCanvas ingestion={…}>` and `SceneCanvasApi.ingest`; the
// kit's handlers come with `@weasel-js/editing`'s `ingestPreset`.
export {
  registerContentHandler,
  contentHandlerRegistry,
  openFilePicker,
} from '../domains/ingestion';
export type {
  ContentHandlerEntry,
  IngestCtx,
  IngestItem,
  KitHandlersOption,
  OpenFilePickerOptions,
} from '../domains/ingestion';

// ─── WeaselProvider: mounts all five kit-root contexts in one wrap ──────────
export { WeaselProvider } from '../WeaselProvider';
export type { WeaselProviderProps } from '../WeaselProvider';

// ─── Layer primitives: RenderLayer, ordered children ────────────────────────
export * from '../core/layers/render';
export { createWorkspaceTintLayer, createModeDecorationLayer } from '../domains/modes/modeLayers';
export type { WorkspaceTintLayerOptions } from '../domains/modes/modeLayers';
export { modeTriggers } from '../domains/modes/modeTriggers';
export type { ModeTriggerHandlers, ModeTriggerParams } from '../domains/modes/modeTriggers';
export { createChildrenLayer } from '../core/layers/children';
export type { CreateChildrenLayerOptions } from '../core/layers/children';

// ─── Debug overlay subsystem (URL-flagged tree-shakeable) ───────────────────
export * from '../debug';
export { DevtoolsLabel, useDevtoolsLabel } from '../canvas/devtoolsLabel';
export type { DevtoolsLabelProps } from '../canvas/devtoolsLabel';
export type { CanvasInspection, CanvasInspectionChange } from '../canvas/deps/inspection';
export type { CoordTraceEntry } from '../canvas/SceneCanvas/coordTrace';

// ─── Layout: the contract a container's layout strategy implements. The
// strategies themselves (freeform, tileGrid, snapPoint) are in @weasel-js/guides.
export * from '../layout';

// ─── Drawn boxes: how the transform actions measure a node (the `drawnBoxes` dep) ─────
export { inkBoxes } from '../canvas/inkBoxes';

// ─── For node kinds and tools another package builds ─────────────────────────
// What a package teaching the canvas a node kind, or shipping a tool for one, builds on:
// `@weasel-js/text-tools` is one.
export { nodeMemo, createNodeMemoScope, type NodeMemoScope } from '../core/scene/nodeMemo';
export { PAINT_SLOT } from '../canvas/nodeShapes/memo';
export { inkReach, strokeOutsetPerAxis } from '../canvas/nodeShapes/nodePaint';
export { paintsPose } from '../canvas/nodeShapes/poseBox';
export { sceneDerivedPathOf, scenePaintedPoseOf } from '../canvas/derivedPath';
export { nodesAsShown, shownLookup } from '../core/scene/nodeAsShown';
export { targetTransformOf, worldToLocal, type TargetTransform } from '../core/geometry/targetFrame';
export { indexedCandidates } from '../canvas/pickIndex/scenePickIndex';
export type { PickBroad, PickCandidate } from '../canvas/pickWalk';
export type { ClipBearing } from '../canvas/ownClip';
export { findMountedCanvas, mountedCanvasRegistry, type MountedCanvas } from '../canvas/mountedCanvases';
export { arrivalBounds } from '../domains/ingestion/placement';
