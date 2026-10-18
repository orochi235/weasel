export * from './types';
export { createTarget, type AxisBuffer, type Target, type TargetAxes, type TargetOptions } from './target';
export type { AxisName, AxisRef } from './axisNames';
export { createTargetTable, type ShownArray, type TargetTable, type TargetTableOptions } from './targetTable';
export { axesOf, type Axes } from './engine/axes';
export { createSlew, slewToward, type Slew, type SlewRates } from './slew';
export {
  ColorOverrideRegistry,
  type ColorOverride, type ColorOverrideFn, type VertexColorChannel,
} from './colorRegistry';
export {
  tweenVertexColors, springVertexColors, staggerVertexColors,
  type TweenVertexColorsOptions, type SpringVertexColorsOptions, type StaggerVertexColorsOptions,
} from './colorHelpers';
export { cycleVertexColors, type CycleVertexColorsOptions, type CycleHandle } from './colorCycle';
export { rainbowVertexColors, solidVertexColors } from './colorArrays';
export type { ColorInterpolate } from './colorInterpolate';
export { bindClip, sampleTrack, toClip } from './timeline';
export type {
  Clip, ClipBinder, ClipEventTrack, ClipKey, ClipSampledTrack, ClipTimeline, ClipTimelineTrack, ClipTrack, ClipValue,
} from './timeline';
export type {
  EventBooking,
  EventBookingHandle,
  EventTrack,
  Keyframe,
  NestedTimeline,
  SampledTrack,
  TimelineClock,
  TimelineEvent,
  TimelineHandle,
  TimelineOptions,
  TimelineTrack,
  Track,
} from './timeline';
export { mirrorPose } from './rig/mirrorPose';
export { resolveSkeleton } from './rig/resolveSkeleton';
export { jointAxes, skeletonAxes } from './rig/skeletonAxes';
export { solveIk, type IkLimit, type IkPoint, type IkResult, type SolveIkOptions } from './rig/solveIk';
export { IDENTITY_JOINT, type Joint, type JointTransform, type Pose, type Skeleton } from './rig/types';
export { motionsFromRest, skinnable, skinPath, type Skin } from './rig/skin';
export { autoSkin, type AutoSkinOptions } from './rig/autoSkin';
export { addJoint, dropSkinJoints, jointAt, jointPositions, moveJoint, removeJoint } from './rig/skeletonEdits';
export { brushWeights, setWeights } from './rig/weightEdits';

// `createLoop` / `createTweenLoop` / `createStagger` / `createTimeline` are
// intentionally NOT re-exported. They take internal seams (supervisor factory,
// completion watcher, timer pair, register) that only `useAnimator` can supply.
// Consumers access these primitives via `animator.loop` / `animator.tweenLoop` /
// `animator.stagger` / `animator.timeline`.
