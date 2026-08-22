// `useInsertTool` removed — it was a duplicate of `useRectTool` (same id
// semantics, same presentation, same single `drag → insert` binding).
// `defineDragInsertTool` was removed earlier for the same reason: every
// insert tool now declares its gesture via `Tool.bindings` and delegates
// to the dispatcher's `insertAction`.
export { useSelectTool, type UseSelectToolOptions } from './select';
// `useResizeTool` and the legacy `useResize` hook are
// deleted. Resize is dispatcher-driven via `resizeAction` + the
// `resizePolicy` dep — consumers wire options through
// `useResizePolicy(...)` instead of constructing an ambient tool.
export { useRotateTool, type UseRotateToolOptions } from './rotate';
export { pickTopMostHit, type PickTopMostHitAdapter } from './pickTopMostHit';
export { useHandTool } from './hand';
export { useTextTool } from './text';
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
export { useRectTool } from './rect';
export { useEllipseTool } from './ellipse';
export { useImageTool, type UseImageToolOptions } from './image';
export {
  useEyedropperTool,
  type UseEyedropperToolOptions,
} from './eyedropper';
export { useLineTool, type LinePoint } from './line';
export { useLassoTool, type UseLassoToolOptions } from './lasso';
export { usePolygonTool, type UsePolygonToolOptions } from './polygon';
export { useStarTool, type UseStarToolOptions } from './star';
export { usePencilTool, type PencilPoint } from './pencil';
