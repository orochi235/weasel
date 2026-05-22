export { useInsertTool, type UseInsertToolOptions } from './useInsertTool';
// Phase 14e Task 3.5: `defineDragInsertTool` removed — its sole consumers
// (`useInsertTool`, `useTextTool`) now declare their gesture via
// `Tool.bindings` and delegate to the dispatcher's `insertAction`.
export {
  useSelectTool,
  type UseSelectToolOptions,
  type AreaSelectOverlayStyle,
  type MoveOverlayStyle,
} from './useSelectTool';
export {
  useNestedSelectTool,
  type UseNestedSelectToolOptions,
  type NestedSelectAdapter,
} from './useNestedSelectTool';
// Phase 14e Task 4: `useResizeTool` and the legacy `useResize` hook are
// deleted. Resize is dispatcher-driven via `resizeAction` + the
// `resizePolicy` dep — consumers wire options through
// `useResizePolicy(...)` instead of constructing an ambient tool.
export { useRotateTool, type UseRotateToolOptions } from './useRotateTool';
export { pickTopMostHit, type PickTopMostHitAdapter } from './pickTopMostHit';
export { applyHitExistingGate } from './hitExistingGate';
export { useHandTool } from './useHandTool';
export { useTextTool, type UseTextToolOptions } from './useTextTool';
// useWheelZoomTool, useWheelPanTool, useKeyboardZoomTool dissolved in Phase 8.5.
// Viewport zoom and pan are now handled by the viewport.zoom and viewport.pan
// action descriptors registered via useStandardActions + useGestureDispatcher.
export { usePinchZoomTool, type PinchZoomToolOpts } from './usePinchZoomTool';
export {
  usePenTool,
  type UsePenToolOptions,
  type UsePenToolReturn,
  type PenScratch,
  type PenAnchor,
  type PenSubpath,
} from './usePenTool';
export { useRectTool, type UseRectToolOptions, type RectBounds } from './useRectTool';
export { useEllipseTool, type UseEllipseToolOptions, type EllipseBounds } from './useEllipseTool';
export {
  useEyedropperTool,
  type UseEyedropperToolOptions,
} from './useEyedropperTool';
export { useLineTool, type UseLineToolOptions, type LinePoint } from './useLineTool';
export { useLassoTool, type UseLassoToolOptions } from './useLassoTool';
export { usePolygonTool, type UsePolygonToolOptions } from './usePolygonTool';
export { useStarTool, type UseStarToolOptions } from './useStarTool';
export { usePencilTool, type UsePencilToolOptions } from './usePencilTool';
