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
export { createGroupEntryContribution, useGroupEntryContribution, GROUP_ENTRY_ID } from './select/groupEntry';
export type { EnterGroupOptions, LeaveGroupOptions } from '../../interactions/actions/defaults/enterGroup';
export { pressTarget, type PressTargetTree } from './pressTarget';
// `useResizeTool` and the legacy `useResize` hook are deleted. Resize is
// dispatcher-driven via `resizeAction` + the `resizePolicy` dep (constraints,
// point snap, group expansion); pose geometry comes from `poseDescriptor`.
export { pickTopMostHit, type PickTopMostHitAdapter } from './pickTopMostHit';
export { useHandTool, dragPanContribution, DRAG_PAN_ID, middleDragPanContribution, MIDDLE_DRAG_PAN_ID } from './hand';
// useWheelZoomTool, useWheelPanTool, useKeyboardZoomTool are dissolved.
// Viewport zoom and pan are now handled by the viewport.zoom and viewport.pan
// action descriptors registered via useStandardActions + useGestureDispatcher.

