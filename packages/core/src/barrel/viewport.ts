/** Part of the `@weasel-js/core` barrel. Views, viewports, and the canvases that show one. */

// ─── Build identity ─────────────────────────────────────────────────────────
export { VERSION } from '../version';

// ─── Features: multi-viewport composition ───────────────────────────────────
export * from '../features/viewports';
export * from '../features/parallax';
export * from '../features/tiling';
export * from '../features/simulation';
export * from '../features/poseRun';
export * from '../features/overlays';

// ─── Viewport: ViewTransform + helpers ──────────────────────────────────────
export * from '../core/viewport/viewTransform';
export type { View, ZoomFactor, ZoomBound } from '../core/viewport/view';
export { viewToTransform, normalizeView, viewZoom } from '../core/viewport/view';
export { meanScale } from '../core/viewport/meanScale';
export { isPlainObject } from '../core/isPlainObject';
export { stableStringify } from '../core/stableStringify';
export { pxExtent, scaleDelta, screenAngleOf, standoff, withinPxBox, withinPxRadius } from '../core/viewport/pxExtent';
export type { Scale2 } from '../core/viewport/pxExtent';
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
export { zoomAt } from '../core/viewport/zoomAt';
export { DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM, ZOOM_FLOOR, normalizeZoom } from '../core/viewport/zoomBounds';
export type { ZoomClampOpts } from '../core/viewport/zoomAt';
export { clampView } from '../core/viewport/clampView';
export type { ClampBounds, CanvasSize } from '../core/viewport/clampView';
export { sceneNodeClientRect } from '../core/viewport/sceneNodeClientRect';
export type { SceneNodeClientRectOpts, NodeClientRect } from '../core/viewport/sceneNodeClientRect';
export * from '../core/viewport/useAutoCenter';

// ─── Scheduling: the visibility gate every weasel frame loop runs behind ────
export { useVisibleRaf } from '../scheduling/useVisibleRaf';
export type { VisibleRaf, VisibleRafOptions, VisibleRafTarget } from '../scheduling/useVisibleRaf';

// ─── Viewport: wheel / velocity / decay / pinch / camera animation ──────────
export * from '../core/viewport/wheelHandler';
export { clientToCanvas } from '@weasel-js/routing';
export { useVelocityTracker } from '../core/viewport/useVelocityTracker';
export { createVelocityTracker } from '../core/viewport/createVelocityTracker';
export type { VelocityTracker } from '../core/viewport/createVelocityTracker';
export { useDecayLoop } from '../core/viewport/useDecayLoop';
export type { DecayLoopConfig, PanBounds, InertiaConfig } from '../core/viewport/useDecayLoop';
export { interpolateView } from '../core/viewport/interpolateView';
export { useViewAnimation, useViewAnimationOn, VIEW_ANIMATION_KEY } from '../core/viewport/useViewAnimation';

// ─── Second view on an existing canvas ──────────────────────────────────────
// `<CanvasView>` is a camera over a rect of a `<SceneCanvas>`'s surface, with
// input routed to it — one GL context, N views. Contrast the detached
// canvases below, which each own their own context.
export { CanvasView } from '../canvas/CanvasView';
export type { CanvasViewProps, ViewRect } from '../canvas/CanvasView';

// ─── Detached scene-view + minimap: read-only canvases with their own GL ─────
// `<SceneViewCanvas>` is a pointer-inert read-only render of a scene at a
// given view; `<MinimapCanvas>` is the opinionated minimap built on top.
export { SceneViewCanvas } from '../canvas/SceneViewCanvas';
export type { SceneViewCanvasProps } from '../canvas/SceneViewCanvas';
// `<DrawCanvas>` is the same detached surface with no scene behind it: a
// command list painted onto a canvas of its own.
export { DrawCanvas } from '../canvas/DrawCanvas';
export type { DrawCanvasProps, DrawCanvasDraw } from '../canvas/DrawCanvas';
export { MinimapCanvas } from '../canvas/MinimapCanvas';
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
} from '../features/minimap';
export type { MinimapContributionOptions, LinkedCursorOptions, CrosshairRect } from '../features/minimap';

// ─── Canvas focus & visibility gating ───────────────────────────────────────
export {
  useCanvasFocus,
  gateLayer,
} from '../features/focus';
export type {
  UseCanvasFocusOptions,
  CanvasFocusReturn,
  GateLayerOptions,
} from '../features/focus';
