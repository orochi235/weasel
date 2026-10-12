export * from './types';
export {
  linear,
  easeIn, easeOut, easeInOut,
  easeInQuad, easeOutQuad, easeInOutQuad,
  easeInCubic, easeOutCubic, easeInOutCubic,
  easeInQuart, easeOutQuart, easeInOutQuart,
  easeInQuint, easeOutQuint, easeInOutQuint,
  easeInSine, easeOutSine, easeInOutSine,
  easeInExpo, easeOutExpo, easeInOutExpo,
  easeInCirc, easeOutCirc, easeInOutCirc,
  easeInBack, easeOutBack, easeInOutBack,
  easeInElastic, easeOutElastic, easeInOutElastic,
  easeInBounce, easeOutBounce, easeInOutBounce,
  EASINGS,
  type EasingName,
  SPRING_PRESETS,
} from '@weasel-js/geom';
export {
  cubicBezierEasing,
  resolveEasing,
} from '@weasel-js/geom';
export type { BezierEasing, EasingSpec } from '@weasel-js/geom';
export { useAnimator } from './useAnimator';
export { createTarget, type Target, type TargetAxes, type TargetOptions } from './target';
export {
  createPoseTarget, poseAxes, scenePoseTarget,
  type PoseTargetOptions, type PoseTargetScene,
} from './poseTarget';
export {
  tweenPose, springPose,
  type TweenPoseOptions, type SpringPoseOptions, type PoseAnimationAdapter,
} from './poseHelpers';
export * from './wrappers';
export {
  createReflowTransition, useAnimatedReflow,
  type AnimatedReflow, type ReflowScene, type ReflowTransitionOptions,
} from './reflow';
export { momentum, type MomentumOptions } from './behaviors/momentum';
export { createSlew, slewToward, type Slew, type SlewRates } from './slew';
export {
  ColorOverrideRegistry,
  type ColorOverride, type ColorOverrideFn, type VertexColorChannel,
} from './colorRegistry';
export {
  srgbU8ToOklab, srgbFloatToOklab, oklabToSrgbU8,
  lerpOklab, oklabToOklch, oklchToOklab, lerpOklch,
  lerpColorArray,
  // Degrees + `#rrggbb`, the form a palette or theme ramp authors in.
  oklchDegToHex, hexToOklchDeg,
  srgbToLinear, linearToSrgb, linearSrgbToOklab, oklabToLinearSrgb,
  srgbToHsl, hslToSrgb, interpolateSrgb,
  type ColorSpace, type OklchDeg, type ColorInterpolationSpace, type HueInterpolation,
} from '@weasel-js/paint';
export {
  tweenVertexColors, springVertexColors, staggerVertexColors,
  type TweenVertexColorsOptions, type SpringVertexColorsOptions, type StaggerVertexColorsOptions,
} from './colorHelpers';
export { cycleVertexColors, type CycleVertexColorsOptions, type CycleHandle } from './colorCycle';
export { rainbowVertexColors, solidVertexColors } from './colorArrays';
export type { ColorInterpolate } from './colorInterpolate';
export { sampleTrack } from './timeline';
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
export { bindRig, mirrorPose, skeletonAxes, resolveSkeleton, rigidRigApply, solveIk, useRig, IDENTITY_JOINT } from './rig';
export type {
  BindRigOptions, IkLimit, IkPoint, IkResult, Joint, JointTransform, Pose, Rig, RigApply, RigApplyContext, RigScene,
  Skeleton, SolveIkOptions,
} from './rig';

// `createLoop` / `createTweenLoop` / `createStagger` / `createTimeline` are
// intentionally NOT re-exported. They take internal seams (supervisor factory,
// completion watcher, timer pair, register) that only `useAnimator` can supply.
// Consumers access these primitives via `animator.loop` / `animator.tweenLoop` /
// `animator.stagger` / `animator.timeline`.
