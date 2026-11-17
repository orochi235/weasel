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
export type { UseMoveOptions } from '../interactions/gestures/moveOptions';
export type { UseResizeOptions } from '../interactions/gestures/resizeOptions';
export type { UseRotateOptions } from '../interactions/gestures/rotateOptions';
export { AUTO_POSE_DESCRIPTOR, isPathLike, isRectPose } from '../core/geometry/autoPoseDescriptor';
export { RECT_POSE_DESCRIPTOR, ROTATED_POSE_DESCRIPTOR, poseDescriptorForNode } from '../core/geometry/poseDescriptor';
export type { PoseDescriptor, TranslateLead } from '../core/geometry/poseDescriptor';
export { cornerResizeHandles, fixedCornerOf, hitCornerHandle } from '../interactions/gestures/resizeHandles';
export type { CornerHandle } from '../interactions/gestures/resizeHandles';
export { pointInRotatedRect, rotatedRectCorners, rectCorners, rotatePoint, aabbCenter } from '../core/geometry/rotatedRect';
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
export {
  openPointerSession, DRAG_THRESHOLD_PX, pastDragThreshold, CONTROL_SELECTOR, isInControlWithin, isPrimaryPress,
} from '@weasel-js/routing';
export type { PointerSession, PointerSessionCallbacks, PointerSessionCancelReason, PointerSessionOptions } from '@weasel-js/routing';
export { startCarry } from '@weasel-js/routing';
export type { Carry, CarryCallbacks, CarryPayload, CarryPointer, CarryStage } from '@weasel-js/routing';
export { createSweepAction, SWEEP_BINDING } from '@weasel-js/routing';
export { BETWEEN_GESTURES } from '@weasel-js/routing';
export type { SweepItem, SweepOptions, SweepPress, SweepRun } from '@weasel-js/routing';
export { enumerateAnchors, withCoord, type PathAnchor } from '../interactions/actions/edit-anchors/geometry';
export {
  locksOf, type EditAnchorsParams, type HandleLock, type HandleLocks,
} from '../interactions/actions/edit-anchors/params';

export { translatePoseViaDescriptor, visualBoundsViaDescriptor } from '../core/geometry/poseDescriptor';
export { resolveSpatialReference } from '../interactions/actions/spatialReference';
export { ANCHORS_GROUP, PATH_GROUP } from '../interactions/actions/pathActionGroups';
export { sceneBoxFrames, scenePoseFrame, worldPoseOf, worldPoses } from '../interactions/actions/poseFrame';
export { undeclaredMagnifications, unitFrameAt, type UndeclaredMagnification } from '../interactions/actions/magnification';
export { moveNodes, moveNodesOps, MOVE_NODES_REQUIRES } from '../interactions/actions/moveNodes';
export type { PoseFrame, PoseReading } from '../interactions/actions/poseFrame';
export type { SpatialReference, SpatialReferenceSources } from '../interactions/actions/spatialReference';
export { lastTransform, recordTransform, forgetTransform } from '../interactions/actions/transform-again/memory';
export type { RepeatableTransform } from '../interactions/actions/transform-again/memory';
export { requiresSelection } from '../interactions/actions/defaults/requiresSelection';
export type { CloneBehavior, CloneBehaviorResult, CloneEnd } from '../interactions/gestures/types';

// ─── Animation primitives (tween, spring, easings) ──────────────────────────
export * from '../animation';

// ─── The `drawnBoxes` dep: the box move, resize, rotate, flip, align and distribute measure ─
export { drawnBoxes, poseBoxes } from '../interactions/actions/drawnBoxes';
export type { DrawnBoxes, DrawnBoxesDeps, DrawnBoxesSource } from '../interactions/actions/drawnBoxes';
