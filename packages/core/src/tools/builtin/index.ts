// `useInsertTool` removed — it was a duplicate of `useRectTool` (same id
// semantics, same presentation, same single `drag → insert` binding).
// `defineDragInsertTool` was removed earlier for the same reason: every
// insert tool now declares its gesture via `Tool.bindings` and delegates
// to the dispatcher's `insertAction`.
export { useSelectTool, useSelectToolWith, type UseSelectToolOptions } from './select';
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
export {
  createGroupEntryContribution, useGroupEntryContribution, GROUP_ENTRY_ID,
} from './select/groupEntry';
export type { EnterGroupOptions, LeaveGroupOptions } from '../../interactions/actions/defaults/enterGroup';
export type { PressTargetTree } from './pressTarget';
// `useResizeTool` and the legacy `useResize` hook are deleted. Resize is
// dispatcher-driven via `resizeAction` + the `resizePolicy` dep (constraints,
// point snap, group expansion); pose geometry comes from `poseDescriptor`.
export { pickTopMostHit, type PickTopMostHitAdapter } from './pickTopMostHit';
export { useHandTool, dragPanContribution, DRAG_PAN_ID } from './hand';
export { anchorsTool, ANCHORS_TOOL_ID } from './anchors';
export { useTextTool, TEXT_TOOL_OPTIONS } from './text';
export {
  useStickyTool, stickyData, stickyNodeFactory, STICKY_DEFAULTS, STICKY_TOOL_OPTIONS,
  type UseStickyToolOptions, type StickyLook, type StickyStyle,
} from './sticky';
// useWheelZoomTool, useWheelPanTool, useKeyboardZoomTool are dissolved.
// Viewport zoom and pan are now handled by the viewport.zoom and viewport.pan
// action descriptors registered via useStandardActions + useGestureDispatcher.
export { PEN_TOOL_OPTIONS } from './pen/penOptions';
export {
  DEFAULT_SHAPE_PAINT, DEFAULT_STROKE_WIDTH, shapeToolOptions, STYLE_OPTION_KEYS, styleOptionLeaves,
  type InsertStyle, type ShapeToolOptionsSpec, type StyleOptionKey,
} from './shared/styleOptions';
export {
  usePenTool,
  type UsePenToolOptions,
  type PenScratch,
  type PenContinuation,
  type PenAnchor,
  type PenSubpath,
} from './pen';
export { useRectTool, RECT_TOOL_OPTIONS } from './rect';
export type { InsertToolOptions } from './shared/insertToolOptions';
export { createPointerFollower, type PointerFollower } from './shared/pointerFollower';
export { useEllipseTool, ELLIPSE_TOOL_OPTIONS } from './ellipse';
export { useImageTool, type UseImageToolOptions } from './image';
export {
  useEyedropperTool,
  type UseEyedropperToolOptions,
} from './eyedropper';
export { useLineTool, LINE_TOOL_OPTIONS, type LinePoint } from './line';
export { useLassoTool, type UseLassoToolOptions } from './lasso';
export { usePolygonTool, POLYGON_TOOL_OPTIONS, type UsePolygonToolOptions } from './polygon';
export { useStarTool, STAR_TOOL_OPTIONS, type UseStarToolOptions } from './star';
export { usePencilTool, PENCIL_TOOL_OPTIONS, type PencilPoint } from './pencil';
export { useSliceTool, type UseSliceToolOptions, type SliceScratch } from './slice';
export { useMeasureTool, type UseMeasureToolOptions } from './measure';
