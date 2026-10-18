/**
 * Part of the `@weasel-js/core` barrel. Drag and keyboard action hooks, snapping, and animation.
 *
 * @packageDocumentation
 */

// ─── Origin projections say how a pose is read and moved; gesture readers
// convert screen pixels through the camera a drag landed in.
export {
  AUTO_ORIGIN_PROJECTION,
  RECT_ORIGIN_PROJECTION,
  screenTolerance,
  gestureViewReader,
  gesturePlaneReader,
} from '../interactions/gestures/shared';
export type { OriginProjection } from '../interactions/gestures/shared';

// ─── Drag-action hooks: move / resize / rotate / insert / area-select / etc. ─
export type { UseMoveOptions } from '../interactions/actions/move';
export {
  AUTO_POSE_DESCRIPTOR,
  isPathLike,
  isRectPose,
  RECT_POSE_DESCRIPTOR,
  ROTATED_POSE_DESCRIPTOR,
  poseDescriptorForNode,
  cornerResizeHandles,
  fixedCornerOf,
  hitCornerHandle,
} from '../interactions/actions/resize';
export type {
  UseResizeOptions,
  PoseDescriptor,
  CornerHandle,
} from '../interactions/actions/resize';
export {
  pointInRotatedRect,
  rotatedRectCorners,
  rectCorners,
  rotatePoint,
  aabbCenter,
  rotationHandle,
  hitRotationHandle,
  DEFAULT_ROTATION_HANDLE_DISTANCE,
} from '../interactions/actions/rotate';
export type {
  UseRotateOptions,
  RotationHandle,
} from '../interactions/actions/rotate';
export { useDragRect } from '../interactions/gestures/dragRect';
export type {
  DragRectController,
  DragRectCtx,
  DragRectEndCtx,
  UseDragRectOptions,
  DragRectPoint,
  DragRectBounds,
} from '../interactions/gestures/dragRect';
export { useDragGesture, dragPointOf } from '../interactions/gestures/dragGesture';
export type {
  UseDragGestureOptions,
  DragGestureController,
  DragGestureCtx,
  DragGestureEndCtx,
  DragGesturePoint,
  DragGesturePhase,
} from '../interactions/gestures/dragGesture';
export { useDragRadial } from '../interactions/gestures/dragRadial';
export type {
  DragRadialPoint,
  DragRadialState,
  DragRadialCtx,
  DragRadialEndCtx,
  UseDragRadialOptions,
  DragRadialController,
} from '../interactions/gestures/dragRadial';
export { openPointerSession, DRAG_THRESHOLD_PX, pastDragThreshold, CONTROL_SELECTOR, isInControlWithin } from '@weasel-js/routing';
export type { PointerSession, PointerSessionCallbacks, PointerSessionCancelReason, PointerSessionOptions } from '@weasel-js/routing';
export { startCarry } from '@weasel-js/routing';
export type { Carry, CarryCallbacks, CarryPayload, CarryPointer, CarryStage } from '@weasel-js/routing';
export { useHandleDrag } from '../interactions/gestures/handleDrag';
export type {
  HandleDragPoint,
  HandleDragEnd,
  UseHandleDragOptions,
  UseHandleDragReturn,
} from '../interactions/gestures/handleDrag';
export { startThresholdDrag } from '../interactions/gestures/thresholdDrag';
export type {
  ThresholdDragOptions,
  ThresholdDragHandle,
} from '../interactions/gestures/thresholdDrag';
export {
  hitAnchor,
  enumerateAnchors,
  withCoord,
} from '../interactions/actions/edit-anchors';
export type {
  AnchorHit,
  EditAnchorsParams,
  HandleLock,
  HandleLocks,
  PathAnchor,
} from '../interactions/actions/edit-anchors';

// ─── Action hooks: selection-driven keyboard / button actions ───────────────
export {
  useClipboardOps,
  WEASEL_CLIPBOARD_MIME,
  WEASEL_CLIPBOARD_MIME_WEB,
  buildWeaselClipboardText,
  sniffWeaselClipboardText,
  parseWeaselClipboardText,
  embedWeaselMetadataInSvg,
  extractWeaselClipboardFromSvg,
} from '../interactions/actions/clipboard';
export type {
  ClipboardFlavors,
  UseClipboardOpsOptions,
  UseClipboardOpsReturn,
} from '../interactions/actions/clipboard';
export {
  useAlign,
  alignDeltaFor,
  alignTargetBounds,
  translatePoseViaDescriptor,
  visualBoundsViaDescriptor,
} from '../interactions/actions/align';
export { resolveSpatialReference } from '../interactions/actions/spatialReference';
export { scenePoseFrame } from '../interactions/actions/poseFrame';
export type { PoseFrame } from '../interactions/actions/poseFrame';
export type { SpatialReference, SpatialReferenceSources } from '../interactions/actions/spatialReference';
export type { FlipAxis, FlipPivot } from '../interactions/actions/flip/helpers';
export { lastTransform, recordTransform, forgetTransform } from '../interactions/actions/transform-again/memory';
export type { RepeatableTransform } from '../interactions/actions/transform-again/memory';
export type {
  AlignAdapter,
  AlignEdge,
  AlignReference,
  UseAlignOptions,
  UseAlignReturn,
} from '../interactions/actions/align';
export { useDistribute } from '../interactions/actions/distribute';
export type {
  DistributeAdapter,
  DistributeAxis,
  DistributeMode,
  UseDistributeOptions,
  UseDistributeReturn,
} from '../interactions/actions/distribute';
export type { CloneBehavior, CloneBehaviorResult } from '../interactions/gestures/types';
// snapToContainer / snapBackOrDelete are NOT re-exported at top level —
// import them from '@weasel-js/core/move'.

// ─── Animation primitives (tween, spring, easings) ──────────────────────────
export * from '../animation';
