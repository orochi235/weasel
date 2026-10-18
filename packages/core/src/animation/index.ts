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
export type { BezierEasing, EasingFn, EasingSpec, SpringPreset, SpringPresetName } from '@weasel-js/geom';
export {
  createPoseTarget, poseAxes, scenePoseTarget,
  type PoseCascade, type PoseTargetOptions, type PoseTargetScene,
} from './poseTarget';
export { createWrittenPoseTarget, type WrittenPoseTargetOptions } from './writtenPoseTarget';
export { sceneClipTargets, type SceneClipTargetsOptions } from './clipTargets';
export {
  tweenPose, springPose, staggerSpringPose,
  type TweenPoseOptions, type SpringPoseOptions, type StaggerSpringPoseOptions,
  type PoseAnimationAdapter,
} from './poseHelpers';
export * from './wrappers';
export {
  createReflowTransition, useAnimatedReflow,
  type AnimatedReflow, type ReflowScene, type ReflowTransitionOptions,
} from './reflow';
export {
  bindPoseTransition, glidesByDefault, usePoseTransition,
  type PoseTransitionScene, type PoseTransitionSeat,
} from './poseTransition';
export { momentum, type MomentumOptions } from './behaviors/momentum';
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
  bindRig, dataRestPath, placeSkeleton, rigFromNode, rigidRigApply, unplaceSkeleton, useRig, useRigNode,
} from './rig';
export type {
  BindRigOptions, PaintedSkins, RestPath, Rig, RigApply, RigApplyContext, RigNodeData, RigNodeParts, RigNodeSource,
  RigScene, UseRigNodeOptions,
} from './rig';
