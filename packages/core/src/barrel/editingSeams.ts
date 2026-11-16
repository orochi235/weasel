/**
 * Core helpers `@weasel-js/editing` reads: the scene, pose and commit plumbing its actions are built on.
 *
 * @packageDocumentation
 */
export { PRESET_CHROME } from '../canvas/SceneCanvas/presets/chrome';
export { toolDrivenActions } from '../canvas/SceneCanvas/presets/toolDriven';
export { isNoInkExtents } from '../core/geometry/inkExtents';
export { bringForward, bringToFront, sendBackward, sendToBack } from '../core/ops/reorder/algorithms';
export { sameValue } from '../core/scene/sameValue';
export { cancelGestureAction } from '../interactions/actions/defaults/cancelGesture';
export { finiteThroughout } from '../interactions/actions/finiteFrame';
export { geometryDataOp } from '../interactions/actions/geometryProjection';
export { moveEachOps } from '../interactions/actions/moveNodes';
export { poseDescriptorOf } from '../interactions/actions/poseDescriptorDep';
export { poseFrame } from '../interactions/actions/poseFrame';
export { shapeSources, uncarried } from '../interactions/actions/selectionSubtree';
export { settleWithinRounding } from '../interactions/actions/settleWithinRounding';
export { actionReferenceSources } from '../interactions/actions/spatialReference';
export { commitTransformOps, transformApplyOps } from '../interactions/actions/transformFinish';
export { reachableInGroup } from '../canvas/deps/enteredGroup';
export { hitTestArea } from '../canvas/deps/hitTestArea';
export { groupingSite } from '../core/pages/pagePlacement';
export { paintInheritors } from '../core/scene/inheritedPaint';
export { couldClaim, handlersFor, runIngest } from '../domains/ingestion/contentHandlers';
export type { RunIngestOptions } from '../domains/ingestion/contentHandlers';
export { previewIngest } from '../domains/ingestion/ghost';
export { kitWeaselJsonHandler } from '../domains/ingestion/weaselJsonHandler';
export { countOperands } from '../interactions/actions/booleans/booleans';
export { copySelection } from '../interactions/actions/defaults/copySubtree';
export { deleteEnabled } from '../interactions/actions/defaults/delete';
export { requiresContent, selectedContent } from '../interactions/actions/defaults/requiresSelection';
export { redoAction, undoAction } from '../interactions/actions/defaults/undoRedo';
export { DUPLICATE_OFFSET } from '../interactions/actions/duplicateOffset';
export { followerMoveOps, followerMoves, followerOpsFor } from '../interactions/actions/followerMoves';
export { inPaintOrder, slotAbove } from '../interactions/actions/groupSlot';
export { insertRotateAction } from '../interactions/actions/insert/rotateAction';
export { nodeDescriptors } from '../interactions/actions/poseDescriptorDep';
export { resizeSelectionOps } from '../interactions/actions/resize/replay';
export { rotateSelectionOps } from '../interactions/actions/rotate/replay';
export { selectedRoots, storedDelta } from '../interactions/actions/selectionSubtree';
export { finishTransformOps } from '../interactions/actions/transformFinish';
export type { CopyPose } from '../interactions/actions/defaults/copySubtree';
export type { FollowerMove } from '../interactions/actions/followerMoves';
export type { GroupingSite } from '../core/pages/pagePlacement';
export { THROUGH_CHROME } from '../tools/builtin/throughChrome';
export { ownClipOf } from '../canvas/ownClip';
export { adapterPickSource, pickWalk, scenePlaneOf } from '../canvas/pickWalk';
export type { PickQuery } from '../canvas/pickWalk';
export { scenePickSource } from '../canvas/scenePickSource';
export { isEnvelope } from '../core/scene/effectivePose';
export { MULTI_RESIZE_TARGET_ID } from '../core/selection/selectionTarget';
export { createEnterGroupAction, createLeaveGroupAction } from '../interactions/actions/defaults/enterGroup';
export { gestureLifecycleParams } from '../interactions/actions/gestureLifecycle';
export { snapToContainer } from '../interactions/actions/move/behaviors/snapToContainer';
export { centersBetween } from '../tools/builtin/select/centersBetween';
export { rangeAmong } from '../tools/builtin/select/selectRange';
