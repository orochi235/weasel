import type { EasingFn, SpringPreset, SpringPresetName } from './types';

// --- Polynomial family (degree 1-5). The unsuffixed `easeIn`/`easeOut`/
// `easeInOut` aliases mirror the `easeInQuad` curve (degree 2) for backwards
// compatibility with existing call sites.

/** No easing: constant rate from start to finish. */
export const linear: EasingFn = (t) => t;

// Quadratic (degree 2)
/** Accelerates from a standstill, gently. */
export const easeInQuad: EasingFn = (t) => t * t;
/** Decelerates to a stop, gently. The safe default for UI motion. */
export const easeOutQuad: EasingFn = (t) => 1 - (1 - t) * (1 - t);
/** Accelerates then decelerates, gently. */
export const easeInOutQuad: EasingFn = (t) =>
  t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);

// Cubic (degree 3)
/** Accelerates from a standstill, moderately. */
export const easeInCubic: EasingFn = (t) => t * t * t;
/** Decelerates to a stop, moderately. */
export const easeOutCubic: EasingFn = (t) => 1 - Math.pow(1 - t, 3);
/** Accelerates then decelerates, moderately. */
export const easeInOutCubic: EasingFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Quartic (degree 4)
/** Accelerates from a standstill, sharply. */
export const easeInQuart: EasingFn = (t) => t * t * t * t;
/** Decelerates to a stop, sharply. */
export const easeOutQuart: EasingFn = (t) => 1 - Math.pow(1 - t, 4);
/** Accelerates then decelerates, sharply. */
export const easeInOutQuart: EasingFn = (t) =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

// Quintic (degree 5)
/** Accelerates from a standstill, very sharply. */
export const easeInQuint: EasingFn = (t) => t * t * t * t * t;
/** Decelerates to a stop, very sharply. */
export const easeOutQuint: EasingFn = (t) => 1 - Math.pow(1 - t, 5);
/** Accelerates then decelerates, very sharply. */
export const easeInOutQuint: EasingFn = (t) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

// --- Trigonometric / transcendental

/** Accelerates from a standstill along a sine curve — the mildest
 *  acceleration of the built-ins. */
export const easeInSine: EasingFn = (t) => 1 - Math.cos((t * Math.PI) / 2);
/** Decelerates to a stop along a sine curve — the mildest
 *  deceleration of the built-ins. */
export const easeOutSine: EasingFn = (t) => Math.sin((t * Math.PI) / 2);
/** Accelerates then decelerates along a sine curve. */
export const easeInOutSine: EasingFn = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Accelerates exponentially: barely moves at first, then rushes. */
export const easeInExpo: EasingFn = (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10));
/** Decelerates exponentially: leaps away, then creeps in. */
export const easeOutExpo: EasingFn = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
/** Exponential at both ends — a very fast middle between two
 *  near-still extremes. */
export const easeInOutExpo: EasingFn = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
};

/** Accelerates along a circular arc: slow start, abrupt arrival. */
export const easeInCirc: EasingFn = (t) => 1 - Math.sqrt(1 - t * t);
/** Decelerates along a circular arc: abrupt start, slow arrival. */
export const easeOutCirc: EasingFn = (t) => Math.sqrt(1 - Math.pow(t - 1, 2));
/** Circular arcs at both ends. */
export const easeInOutCirc: EasingFn = (t) =>
  t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;

// --- Overshoot / oscillate / decay (Penner's named curves).
// Constants are the well-known defaults; a future iteration could expose
// per-call tuning (stiffness on back, amplitude/period on elastic).

const C1 = 1.70158;          // back overshoot
const C2 = C1 * 1.525;       // back inOut
const C3 = C1 + 1;
const C4 = (2 * Math.PI) / 3; // elastic in/out
const C5 = (2 * Math.PI) / 4.5;

/** Pulls back past the start before moving forward. Overshoots below 0. */
export const easeInBack: EasingFn = (t) => C3 * t * t * t - C1 * t * t;
/** Overshoots the target, then settles back onto it. Exceeds 1. */
export const easeOutBack: EasingFn = (t) =>
  1 + C3 * Math.pow(t - 1, 3) + C1 * Math.pow(t - 1, 2);
/** Overshoots at both ends. Leaves the 0–1 range on each side. */
export const easeInOutBack: EasingFn = (t) =>
  t < 0.5
    ? (Math.pow(2 * t, 2) * ((C2 + 1) * 2 * t - C2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((C2 + 1) * (2 * t - 2) + C2) + 2) / 2;

/** Oscillates around the start with growing amplitude, then snaps away. */
export const easeInElastic: EasingFn = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * C4);
};
/** Springs past the target and wobbles into it. Exceeds 1. */
export const easeOutElastic: EasingFn = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * C4) + 1;
};
/** Wobbles at both ends. Leaves the 0–1 range on each side. */
export const easeInOutElastic: EasingFn = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5
    ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * C5)) / 2
    : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * C5)) / 2 + 1;
};

/** Lands on the target and bounces, in hops of decreasing height. */
export const easeOutBounce: EasingFn = (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) { t -= 1.5 / d1;   return n1 * t * t + 0.75; }
  if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
  t -= 2.625 / d1;
  return n1 * t * t + 0.984375;
};
/** Bounces up to the start before departing — `easeOutBounce` reversed. */
export const easeInBounce: EasingFn = (t) => 1 - easeOutBounce(1 - t);
/** Bounces at both ends. */
export const easeInOutBounce: EasingFn = (t) =>
  t < 0.5
    ? (1 - easeOutBounce(1 - 2 * t)) / 2
    : (1 + easeOutBounce(2 * t - 1)) / 2;

// --- Backwards-compat aliases. Pre-library callers asked for `easeIn`/
// `easeOut`/`easeInOut`; those resolve to the quadratic curve.
/** Alias for `easeInQuad`, kept for call sites that predate the
 *  named-curve library. */
export const easeIn = easeInQuad;
/** Alias for `easeOutQuad`, kept for call sites that predate the
 *  named-curve library. */
export const easeOut = easeOutQuad;
/** Alias for `easeInOutQuad`, kept for call sites that predate the
 *  named-curve library. */
export const easeInOut = easeInOutQuad;

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
} as const;

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
