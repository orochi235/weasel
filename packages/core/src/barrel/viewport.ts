/**
 * Part of the `@weasel-js/core` barrel. Views, viewports, and the canvases that show one.
 *
 * @packageDocumentation
 */

// ─── Build identity ─────────────────────────────────────────────────────────
export { VERSION } from '../version';

// ─── Features: multi-viewport composition ───────────────────────────────────
export * from '../domains/viewports';
export {
  deriveParallaxView, planeMap, toPlane, fromPlane, rectToPlane, rectFromPlane, planeToPlane, planeMatrix,
} from '../core/viewport/parallax';
export type { ParallaxOpts, ScalarOrXY, PlaneMap } from '../core/viewport/parallax';
export {
  createSimulation,
  DEFAULT_ALPHA_DECAY,
  DEFAULT_ALPHA_MIN,
  DEFAULT_VELOCITY_DECAY,
} from '@weasel-js/simulation';
export type {
  Simulation,
  SimulationCore,
  SimulationForce,
  SimulationNode,
  SimulationOptions,
  UseSimulationOptions,
} from '@weasel-js/simulation';
export { useSimulation } from '@weasel-js/simulation/react';
export * from '../domains/poseRun';
export { useNodeOverlayFrame } from '../core/viewport/useNodeOverlayFrame';
export type {
  NodeOverlayFrame,
  OverlayPoint,
  UseNodeOverlayFrameOptions,
} from '../core/viewport/useNodeOverlayFrame';

// ─── Viewport: ViewTransform + helpers ──────────────────────────────────────
export * from '../core/viewport/viewTransform';
export type { View, ZoomFactor, ZoomBound } from '../core/viewport/view';
export { viewToTransform, normalizeView, viewZoom } from '../core/viewport/view';
export { meanScale } from '@weasel-js/geom';
export { isPlainObject } from '../core/isPlainObject';
export { stableStringify } from '../core/stableStringify';
export { pxExtent, scaleDelta, screenAngleOf, standoff, withinPxBox, withinPxRadius } from '@weasel-js/geom';
export type { Scale2 } from '@weasel-js/geom';
export type { ScreenSlop, PickSlop } from '../core/viewport/screenSlop';
export * from '../interactions/gestures/handleDrag';
export * from '../interactions/gestures/pointerDrag';
export * from '../interactions/gestures/thresholdDrag';
export * from '../core/viewport/useCanvasSize';
export {
  COARSE_TARGET_SCALE,
  DEFAULT_DEVICE_PROFILE,
  DeviceProfileProvider,
  HANDLE_BASE_PX,
  ANCHOR_HIT_BASE_PX,
  ROTATION_HANDLE_BASE_PX,
  resolveDeviceProfile,
  useDeviceProfile,
  watchDevicePixelRatio,
  type DeviceProfile,
  type DeviceProfileProviderProps,
  type DetectedDeviceFacts,
} from '../core/device';
export * from '../core/viewport/fitToBounds';
export { fitViewToBounds } from '../core/viewport/fitViewToBounds';
export type { Bounds, ViewportDims, FitViewToBoundsOptions } from '../core/viewport/fitViewToBounds';
export { adjacentPage, layoutPages, pageAt, pageHolding, pageName, pageOfBounds, pagesBounds } from '../core/pages/pages';
export type { Page, PageLayoutOptions, PlacedPage } from '../core/pages/pages';
export { pagesLayer, type PagesLayerOptions } from '../core/pages/pagesLayer';
export { fitViewToPage, pageInView } from '../core/pages/fitViewToPage';
export {
  PAGES_DOC_KEY, addPage, movePage, nextPageId, pageMembers, pagesOf, placedPagesOf, removePage, renamePage, resizePage,
  setPages,
} from '../core/pages/pageEdits';
export type { PageEditOptions, PagesDoc } from '../core/pages/pageEdits';
export { zoomAt, axisZoomFactor } from '../core/viewport/zoomAt';
export { DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM, ZOOM_FLOOR, normalizeZoom } from '../core/viewport/zoomBounds';
export type { ZoomClampOpts, ZoomAxis } from '../core/viewport/zoomAt';
export { clampView } from '../core/viewport/clampView';
export { viewportWorldRect } from '../core/viewport/viewportWorldRect';
export type { ClampBounds, CanvasSize } from '../core/viewport/clampView';
export { sceneNodeClientRect } from '../core/viewport/sceneNodeClientRect';
export type { SceneNodeClientRectOpts, NodeClientRect } from '../core/viewport/sceneNodeClientRect';
export * from '../core/viewport/useAutoCenter';

// ─── Scheduling: the visibility gate every weasel frame loop runs behind ────
export { useVisibleRaf } from '@weasel-js/react';
export type { VisibleRaf, VisibleRafOptions, VisibleRafTarget } from '@weasel-js/react';
export { useFrameClock } from '@weasel-js/react';
export type { FrameClock, FrameClockOptions } from '@weasel-js/react';

// ─── Viewport: wheel / velocity / decay / pinch / camera animation ──────────
export * from '../core/viewport/wheelHandler';
export { clientToCanvas } from '@weasel-js/routing';
export type { ViewLike } from '../core/viewport/clientToWorld';
export { useVelocityTracker } from '../core/viewport/useVelocityTracker';
export { createVelocityTracker } from '../core/viewport/createVelocityTracker';
export type { VelocityTracker } from '../core/viewport/createVelocityTracker';
export { useDecayLoop } from '../core/viewport/useDecayLoop';
export type { DecayLoopConfig, PanBounds, InertiaConfig } from '../core/viewport/useDecayLoop';
export { interpolateView } from '../core/viewport/interpolateView';
export { useViewAnimation, useViewAnimationOn, viewAxes, VIEW_ANIMATION_KEY } from '../core/viewport/useViewAnimation';

// ─── Second view on an existing canvas ──────────────────────────────────────
// `<CanvasView>` is a camera over a rect of a `<SceneCanvas>`'s surface, with
// input routed to it — one GL context, N views. Contrast the detached
// canvases below, which each own their own context.
export { CanvasView } from '../canvas/CanvasView';
export type {
  CanvasViewProps, CanvasViewCommonProps, CameraHeldViewProps, AimHeldViewProps, ViewRect,
} from '../canvas/canvasViewProps';
export type { CanvasViewCamera } from '../canvas/canvasExtension';
// `<ViewMarker>` outlines one view's aim inside another's frame.
export { ViewMarker } from '../canvas/ViewMarker';
export {
  createViewMarkerLayer, grabViewMarker, VIEW_MARKER_DEFAULT_STYLE, VIEW_MARKER_HIT_SLOP_PX,
} from '../domains/viewports/viewMarker';
export type {
  ViewMarkerProps, ViewMarkerStyle, ViewMarkerHost, AimSource, ViewMarkerGrab,
} from '../domains/viewports/viewMarker';
export { VIEW_MARKER_DRAG, viewMarkerDragAction, createViewMarkerContribution } from '../domains/viewports/viewMarkerDrag';

// ─── Detached scene-view + minimap: read-only canvases with their own GL ─────
// `<SceneViewCanvas>` is a pointer-inert read-only render of a scene at a
// given view; `<MinimapCanvas>` is the opinionated minimap built on top.
export { SceneViewCanvas } from '../canvas/SceneViewCanvas';
export type { SceneViewCanvasProps } from '../canvas/SceneViewCanvas';
export type { SurfaceSizeProps } from '../canvas/useSurfaceSize';
// `<DrawCanvas>` is the same detached surface with no scene behind it: a
// command list painted onto a canvas of its own.
export { DrawCanvas } from '../canvas/DrawCanvas';
export type { DrawCanvasProps, DrawCanvasDraw } from '../canvas/DrawCanvas';
// The accent a canvas's chrome paints in, read off the theme cascade.
export { accentColorOf, FALLBACK_ACCENT } from '../canvas/accentColor';

// ─── Canvas focus & visibility gating ───────────────────────────────────────
export { gateLayer } from '../core/layers/gateLayer';
export type { GateLayerOptions } from '../core/layers/gateLayer';
export { useCanvasFocus } from '@weasel-js/react';
export type { UseCanvasFocusOptions, CanvasFocusReturn } from '@weasel-js/react';
