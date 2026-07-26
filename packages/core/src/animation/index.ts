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
} from './easings';
export { useAnimator } from './useAnimator';
export {
  tweenPose, springPose,
  type TweenPoseOptions, type SpringPoseOptions,
} from './poseHelpers';
export * from './wrappers';
export { momentum, type MomentumOptions } from './behaviors/momentum';
export {
  ColorOverrideRegistry,
  type ColorOverride, type ColorOverrideFn, type VertexColorChannel,
} from './colorRegistry';
export {
  srgbU8ToOklab, oklabToSrgbU8,
  lerpOklab, oklabToOklch, oklchToOklab, lerpOklch,
  lerpColorArray,
  type ColorSpace,
} from './colorSpaces';
export {
  tweenVertexColors, springVertexColors, cycleVertexColors, staggerVertexColors,
  rainbowVertexColors, solidVertexColors,
  type TweenVertexColorsOptions, type SpringVertexColorsOptions,
  type CycleVertexColorsOptions, type StaggerVertexColorsOptions,
  type CycleHandle, type ColorInterpolate,
} from './colorHelpers';
// `createLoop` / `createTweenLoop` / `createStagger` are intentionally NOT
// re-exported. They take internal seams (supervisor factory, completion
// watcher, timer pair) that only `useAnimator` can supply. Consumers access
// these primitives via `animator.loop` / `animator.tweenLoop` /
// `animator.stagger`.
