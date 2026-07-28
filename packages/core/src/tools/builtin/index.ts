export { useInsertTool, type UseInsertToolOptions } from './insert';
// `defineDragInsertTool` removed — its sole consumers
// (`useInsertTool`, `useTextTool`) now declare their gesture via
// `Tool.bindings` and delegate to the dispatcher's `insertAction`.
export {
  useSelectTool,
  type UseSelectToolOptions,
  type AreaSelectOverlayStyle,
  type MoveOverlayStyle,
} from './select';
export {
  useNestedSelectTool,
  type UseNestedSelectToolOptions,
  type NestedSelectAdapter,
} from './useNestedSelectTool';
// `useResizeTool` and the legacy `useResize` hook are
// deleted. Resize is dispatcher-driven via `resizeAction` + the
// `resizePolicy` dep — consumers wire options through
// `useResizePolicy(...)` instead of constructing an ambient tool.
export { useRotateTool, type UseRotateToolOptions } from './rotate';
export { pickTopMostHit, type PickTopMostHitAdapter } from './pickTopMostHit';
export { applyHitExistingGate } from './hitExistingGate';
export { useHandTool } from './hand';
export { useTextTool, type UseTextToolOptions } from './text';
// useWheelZoomTool, useWheelPanTool, useKeyboardZoomTool are dissolved.
// Viewport zoom and pan are now handled by the viewport.zoom and viewport.pan
// action descriptors registered via useStandardActions + useGestureDispatcher.
export { usePinchZoomTool, type PinchZoomToolOpts } from './pinchZoom';
export {
  usePenTool,
  type UsePenToolOptions,
  type PenScratch,
  type PenAnchor,
  type PenSubpath,
} from './pen';
export { useRectTool, type UseRectToolOptions, type RectBounds } from './rect';
export { useEllipseTool, type UseEllipseToolOptions, type EllipseBounds } from './ellipse';
export { useImageTool, type UseImageToolOptions } from './image';
export {
  useEyedropperTool,
  type UseEyedropperToolOptions,
} from './eyedropper';
export { useLineTool, type UseLineToolOptions, type LinePoint } from './line';
export { useLassoTool, type UseLassoToolOptions } from './lasso';
export { usePolygonTool, type UsePolygonToolOptions } from './polygon';
export { useStarTool, type UseStarToolOptions } from './star';
export { usePencilTool, type UsePencilToolOptions } from './pencil';
