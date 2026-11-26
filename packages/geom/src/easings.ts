import { curve, type PennerName } from '@msb235/blits';

/** An easing curve: maps normalized progress `t ∈ [0, 1]` to eased progress.
 *  Curves may leave the 0–1 range in the middle (back, elastic) but should
 *  pass through 0 at 0 and 1 at 1. */
export type EasingFn = (t: number) => number;

/** A spring's physical parameters. Higher stiffness settles faster, higher
 *  damping overshoots less, higher mass makes both sluggish. */
export interface SpringPreset {
  stiffness: number;
  damping: number;
  mass: number;
}

/** One of the tunings in `SPRING_PRESETS`. */
export type SpringPresetName = 'gentle' | 'wobbly' | 'stiff' | 'slow';

// Penner's curves are blits' `curve()` names, stored there as a CSS cubic-bezier within 0.003 of
// Penner's function or `linear()` points within 0.001, so they also run on blits' GPU path.

/** No easing: constant rate from start to finish. */
export const linear: EasingFn = /* @__PURE__ */ curve('linear');

/** Accelerates from a standstill, gently. */
export const easeInQuad: EasingFn = /* @__PURE__ */ curve('easeInQuad');
/** Decelerates to a stop, gently. The safe default for UI motion. */
export const easeOutQuad: EasingFn = /* @__PURE__ */ curve('easeOutQuad');
/** Accelerates then decelerates, gently. */
export const easeInOutQuad: EasingFn = /* @__PURE__ */ curve('easeInOutQuad');

/** Accelerates from a standstill, moderately. */
export const easeInCubic: EasingFn = /* @__PURE__ */ curve('easeInCubic');
/** Decelerates to a stop, moderately. */
export const easeOutCubic: EasingFn = /* @__PURE__ */ curve('easeOutCubic');
/** Accelerates then decelerates, moderately. */
export const easeInOutCubic: EasingFn = /* @__PURE__ */ curve('easeInOutCubic');

/** Accelerates from a standstill, sharply. */
export const easeInQuart: EasingFn = /* @__PURE__ */ curve('easeInQuart');
/** Decelerates to a stop, sharply. */
export const easeOutQuart: EasingFn = /* @__PURE__ */ curve('easeOutQuart');
/** Accelerates then decelerates, sharply. */
export const easeInOutQuart: EasingFn = /* @__PURE__ */ curve('easeInOutQuart');

/** Accelerates from a standstill, very sharply. */
export const easeInQuint: EasingFn = /* @__PURE__ */ curve('easeInQuint');
/** Decelerates to a stop, very sharply. */
export const easeOutQuint: EasingFn = /* @__PURE__ */ curve('easeOutQuint');
/** Accelerates then decelerates, very sharply. */
export const easeInOutQuint: EasingFn = /* @__PURE__ */ curve('easeInOutQuint');

/** Accelerates from a standstill along a sine curve — the mildest
 *  acceleration of the built-ins. */
export const easeInSine: EasingFn = /* @__PURE__ */ curve('easeInSine');
/** Decelerates to a stop along a sine curve — the mildest
 *  deceleration of the built-ins. */
export const easeOutSine: EasingFn = /* @__PURE__ */ curve('easeOutSine');
/** Accelerates then decelerates along a sine curve. */
export const easeInOutSine: EasingFn = /* @__PURE__ */ curve('easeInOutSine');

/** Accelerates exponentially: barely moves at first, then rushes. */
export const easeInExpo: EasingFn = /* @__PURE__ */ curve('easeInExpo');
/** Decelerates exponentially: leaps away, then creeps in. */
export const easeOutExpo: EasingFn = /* @__PURE__ */ curve('easeOutExpo');
/** Exponential at both ends — a very fast middle between two
 *  near-still extremes. */
export const easeInOutExpo: EasingFn = /* @__PURE__ */ curve('easeInOutExpo');

/** Accelerates along a circular arc: slow start, abrupt arrival. */
export const easeInCirc: EasingFn = /* @__PURE__ */ curve('easeInCirc');
/** Decelerates along a circular arc: abrupt start, slow arrival. */
export const easeOutCirc: EasingFn = /* @__PURE__ */ curve('easeOutCirc');
/** Circular arcs at both ends. */
export const easeInOutCirc: EasingFn = /* @__PURE__ */ curve('easeInOutCirc');

/** Pulls back past the start before moving forward. Overshoots below 0. */
export const easeInBack: EasingFn = /* @__PURE__ */ curve('easeInBack');
/** Overshoots the target, then settles back onto it. Exceeds 1. */
export const easeOutBack: EasingFn = /* @__PURE__ */ curve('easeOutBack');
/** Overshoots at both ends. Leaves the 0–1 range on each side. */
export const easeInOutBack: EasingFn = /* @__PURE__ */ curve('easeInOutBack');

/** Oscillates around the start with growing amplitude, then snaps away. */
export const easeInElastic: EasingFn = /* @__PURE__ */ curve('easeInElastic');
/** Springs past the target and wobbles into it. Exceeds 1. */
export const easeOutElastic: EasingFn = /* @__PURE__ */ curve('easeOutElastic');
/** Wobbles at both ends. Leaves the 0–1 range on each side. */
export const easeInOutElastic: EasingFn = /* @__PURE__ */ curve('easeInOutElastic');

/** Lands on the target and bounces, in hops of decreasing height. */
export const easeOutBounce: EasingFn = /* @__PURE__ */ curve('easeOutBounce');
/** Bounces up to the start before departing — `easeOutBounce` reversed. */
export const easeInBounce: EasingFn = /* @__PURE__ */ curve('easeInBounce');
/** Bounces at both ends. */
export const easeInOutBounce: EasingFn = /* @__PURE__ */ curve('easeInOutBounce');

/** All easings in one bag — useful for demos / pickers. */
export const EASINGS = {
  linear,
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
} as const satisfies Record<PennerName | 'linear', EasingFn>;

/** The name of one of the built-in easing curves. */
export type EasingName = keyof typeof EASINGS;

/** Named spring tunings, from softest to firmest. Springs settle on a target
 *  rather than running for a fixed duration, so these are an alternative to an
 *  easing curve, not a modifier on one. */
export const SPRING_PRESETS: Record<SpringPresetName, SpringPreset> = {
  gentle: { stiffness: 120, damping: 14, mass: 1 },
  wobbly: { stiffness: 180, damping: 12, mass: 1 },
  stiff: { stiffness: 210, damping: 20, mass: 1 },
  slow: { stiffness: 80, damping: 20, mass: 1 },
};
