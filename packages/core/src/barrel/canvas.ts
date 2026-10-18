/**
 * Part of the `@weasel-js/core` barrel. SceneCanvas, ingestion, layers, and the kit-root provider.
 *
 * @packageDocumentation
 */

// ─── SceneCanvas: the top-level renderer ─────────────────────────────────────
// `Canvas` is intentionally NOT exported — it is `@internal` / `@deprecated`
// (bare `<Canvas>` is not a supported consumer surface). Internal consumers
// import it directly from `./canvas/Canvas`. Its types (`CanvasProps`, slot
// configs, etc.) remain exported below because they form part of SceneCanvas's
// public surface.
export { SceneCanvas, DEFAULT_HANDLE_SIZE } from '../canvas/SceneCanvas';
export { OVERLAY_ROLE_STROKES } from '../canvas/overlayRoleStrokes';
export { LeanSceneCanvas, type LeanSceneCanvasProps } from '../canvas/LeanSceneCanvas';
export { defaultDrawOne, defaultPaintBounds } from '../canvas/defaultDrawOne';
export { overChildren, isOverChildren, splitOverChildren } from '../canvas/overChildren';
export type { PaintBoundsFn } from '../canvas/paintCull';
export type { SceneCanvasProps, SceneCanvasHit, SceneCanvasLayers, SceneCanvasLongPress } from '../canvas/SceneCanvas';
export type { SceneCanvasGeometry } from '../canvas/SceneCanvas/geometryProps';
export type { SceneCanvasViewport } from '../canvas/SceneCanvas/viewportProp';
export type { PathEditHost, PathEditOpening } from '../canvas/SceneCanvas/pathEditHost';
export { hostAnchorRect, hostAnchorCss } from '../canvas/hostAnchor';
export type { HostAnchorInput, HostAnchorAlign, HostAnchorOffset } from '../canvas/hostAnchor';
export { useHostAnchor } from '../canvas/useHostAnchor';
export type { UseHostAnchorOptions, HostAnchorStyle } from '../canvas/useHostAnchor';
export { CursorCoordsHud } from '../canvas/CursorCoordsHud';
export type { CursorCoordsHudProps } from '../canvas/CursorCoordsHud';
export { PickHud } from '../canvas/PickHud';
export type { PickHudProps } from '../canvas/PickHud';
export {
  registerNodeShape,
  findNodeShape,
  findShapeSilhouette,
  findShapeInk,
  findShapeBounds,
  DEFAULT_INK,
  shapeCoversPoint,
  getNodeShapes,
} from '../canvas/NodeShape';
export type {
  NodeShapeEntry,
  NodeInk,
  NodeInkCtx,
  NodeSilhouetteCtx,
  RegisterNodeShapeOptions,
  NodePaintCtx,
  ShapeCoversPointOptions,
} from '../canvas/NodeShape';
export { drawnBoundsOf, drawnAABBOf, inkExtentsOf, findShapeDrawnBounds } from '../canvas/drawnBounds';
export type { DrawnBoundsOptions, DrawnBoundsScene } from '../canvas/drawnBounds';
export type { InkExtents } from '../core/geometry/inkExtents';
export {
  bitmapSrc,
  getImageBitmap,
  imageStatus,
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
  type NodeRoutingEntry,
  type NodeRouting,
} from '../core/scene/NodeRouting';
export { defaultNodeRouting, inferredNodeRouting } from '../canvas/SceneCanvas/defaultNodeRouting';
export { createNodeProperties } from '../core/scene/NodeProperties';
export { minSizeOf, type MinSize } from '../core/scene/minSize';
export type { NodeProperties, NodePropertiesEntry } from '../core/scene/NodeProperties';
export {
  defaultNodeProperties,
  inferredNodeProperties,
  rotationDegreesUnit,
} from '../canvas/SceneCanvas/defaultNodeProperties';
export type { CanvasProps, CanvasRetainOptions } from '../canvas/Canvas';
export type { ViewPoseAdapter } from '../canvas/useViewHelpers';
export type { CameraProps, CanvasViewState } from '../canvas/useCanvasView';
export type { CanvasHelpers, CanvasViewHelpers, CanvasSurfaceHelpers } from '../canvas/useViewHelpers';
export type { StandardSlotName, CustomLayerEntry } from '../canvas/layerSlots';
export type { CanvasExtensionApi, CanvasViewHandle, SceneCanvasApi } from '../canvas/canvasExtension';
// The in-flight gesture seam behind `CanvasHelpers.getGestureBounds()` /
// `subscribeGestures()`. `<SceneCanvas>` wires it from its dispatcher; bare
// `<Canvas>` consumers can supply their own.
export type { GestureSource, GesturePreviewSource } from '../canvas/gestureBounds';
export { resolvePreviews, flattenPreviews } from '../interactions/actions/resolvePreviews';
export type { PreviewNode } from '../interactions/actions/resolvePreviews';
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
// `runIngest`, `getContentHandlers`, `kitImageHandler`, and the refcounted
// kit-handler registration are deliberately NOT exported — consumers reach
// the pipeline via `<SceneCanvas ingestion={…}>` and `SceneCanvasApi.ingest`.
// `kitTextHandler` is exported because no canvas registers it by default.
export {
  registerContentHandler,
  openFilePicker,
  kitTextHandler,
} from '../features/ingestion';
export type {
  ContentHandlerEntry,
  IngestCtx,
  IngestItem,
  OpenFilePickerOptions,
} from '../features/ingestion';

// ─── WeaselProvider: mounts all five kit-root contexts in one wrap ──────────
export { WeaselProvider } from '../WeaselProvider';
export type { WeaselProviderProps } from '../WeaselProvider';

// ─── Layer primitives: RenderLayer, ordered children ────────────────────────
export * from '../core/layers/render';
export { workspaceTintLayer, modeDecorationLayer } from '../features/modes/modeLayers';
export type { WorkspaceTintLayerOptions } from '../features/modes/modeLayers';
export { createChildrenLayer } from '../core/layers/children';
export type { CreateChildrenLayerOpts } from '../core/layers/children';

// ─── Debug overlay subsystem (URL-flagged tree-shakeable) ───────────────────
export * from '../debug';

// ─── Layout: the contract a container's layout strategy implements. The
// strategies themselves (freeform, tileGrid, snapPoint) are in @weasel-js/guides.
export * from '../layout';
