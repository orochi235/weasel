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
export {
  tweenPose, springPose,
  type TweenPoseOptions, type SpringPoseOptions,
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
  tweenVertexColors, springVertexColors, cycleVertexColors, staggerVertexColors,
  rainbowVertexColors, solidVertexColors,
  type TweenVertexColorsOptions, type SpringVertexColorsOptions,
  type CycleVertexColorsOptions, type StaggerVertexColorsOptions,
  type CycleHandle, type ColorInterpolate,
} from './colorHelpers';
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
export { bindRig, blendPoses, mirrorPose, resolveSkeleton, rigidRigApply, solveIk, useRig, IDENTITY_JOINT } from './rig';
export type {
  BindRigOptions, IkLimit, IkPoint, IkResult, Joint, JointTransform, Pose, Rig, RigApply, RigApplyContext, RigScene,
  Skeleton, SolveIkOptions,
} from './rig';

// `createLoop` / `createTweenLoop` / `createStagger` / `createTimeline` are
// intentionally NOT re-exported. They take internal seams (supervisor factory,
// completion watcher, timer pair, register) that only `useAnimator` can supply.
// Consumers access these primitives via `animator.loop` / `animator.tweenLoop` /
// `animator.stagger` / `animator.timeline`.
