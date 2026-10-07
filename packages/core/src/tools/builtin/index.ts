// `useInsertTool` removed — it was a duplicate of `useRectTool` (same id
// semantics, same presentation, same single `drag → insert` binding).
// `defineDragInsertTool` was removed earlier for the same reason: every
// insert tool now declares its gesture via `Tool.bindings` and delegates
// to the dispatcher's `insertAction`.
export { useSelectTool, type UseSelectToolOptions } from './select';
export {
  selectionMoveContribution,
  selectionMoveBindings,
  selectionTransformContribution,
  selectionTransformBindings,
  selectionResizeContribution,
  selectionResizeBindings,
  selectionRotateContribution,
  selectionRotateBindings,
  areaSelectContribution,
  onEmptyCanvas,
  AREA_SELECT_ID,
  SELECTION_MOVE_ID,
  SELECTION_TRANSFORM_ID,
  SELECTION_RESIZE_ID,
  SELECTION_ROTATE_ID,
  type SelectionMoveOptions,
  type SelectionTransformOptions,
  type SelectionRotateOptions,
} from './select';
// `useResizeTool` and the legacy `useResize` hook are deleted. Resize is
// dispatcher-driven via `resizeAction` + the `resizePolicy` dep (constraints,
// point snap, group expansion); pose geometry comes from `poseDescriptor`.
export { pickTopMostHit, type PickTopMostHitAdapter } from './pickTopMostHit';
export { useHandTool, dragPanContribution, DRAG_PAN_ID } from './hand';
export { useTextTool } from './text';
// useWheelZoomTool, useWheelPanTool, useKeyboardZoomTool are dissolved.
// Viewport zoom and pan are now handled by the viewport.zoom and viewport.pan
// action descriptors registered via useStandardActions + useGestureDispatcher.
export {
  usePenTool,
  type UsePenToolOptions,
  type PenScratch,
  type PenContinuation,
  type PenAnchor,
  type PenSubpath,
} from './pen';
export { useRectTool } from './rect';
export type { InsertToolOptions } from './shared/insertToolOptions';
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
export { useSliceTool, type UseSliceToolOptions, type SliceScratch } from './slice';
