export type EasingFn = (t: number) => number;

export type Interpolate<T> = (from: T, to: T, t: number) => T;

export interface SpringPreset {
  stiffness: number;
  damping: number;
  mass: number;
}

export type SpringPresetName = 'gentle' | 'wobbly' | 'stiff' | 'slow';

export interface AnimationHandle {
  /** Monotonic id assigned by the animator. */
  id: number;
  /** Cancel this animation. Idempotent — no-op once already finished/canceled. */
  cancel(): void;
  /** Freeze this animation's virtual clock. Idempotent. */
  pause(): void;
  /** Resume this animation's virtual clock. Idempotent. */
  resume(): void;
  /** Multiply this animation's virtual-clock rate by `scale`. 1 = normal. */
  setTimeScale(scale: number): void;
  /** True iff this handle is currently paused. */
  isPaused(): boolean;
}

export interface TweenOptions<T> {
  from: T;
  to: T;
  ms: number;
  easing?: EasingFn;
  /** Required when T is not `number`. For T = number, defaults to linear numeric lerp. */
  interpolate?: Interpolate<T>;
  onTick: (value: T) => void;
  onDone?: () => void;
  /** Any new animation passed the same cancelKey cancels the prior one in flight. */
  cancelKey?: string;
}

export interface SpringOptions<T> {
  from: T;
  to: T;
  /** Initial velocity in T-units per second. Default: zero (T-shape-aware). */
  velocity?: T;
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  interpolate?: Interpolate<T>;
  /** Vector helpers — required for non-numeric T. */
  add?: (a: T, b: T) => T;
  subtract?: (a: T, b: T) => T;
  scale?: (v: T, k: number) => T;
  magnitude?: (v: T) => number;
  /** Velocity magnitude below which the spring is considered settled. Default 0.01. */
  restThreshold?: number;
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
}

export interface DecayOptions<T> {
  from: T;
  velocity: T;
  /** Per-second velocity multiplier in (0, 1). Default 0.95. */
  friction?: number;
  /** Velocity magnitude below which decay stops. Default 0.5. */
  threshold?: number;
  add: (a: T, b: T) => T;
  scale: (v: T, k: number) => T;
  magnitude: (v: T) => number;
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
}

export interface UseAnimatorOptions {
  /** Optional clock injection for tests. Returns ms since some epoch. */
  now?: () => number;
  /** Optional rAF / cAF injection for tests. Defaults to window.requestAnimationFrame. */
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

export interface Animator {
  tween<T>(opts: TweenOptions<T>): AnimationHandle;
  spring<T>(opts: SpringOptions<T>): AnimationHandle;
  decay<T>(opts: DecayOptions<T>): AnimationHandle;
  /** Cancel a specific animation by handle. Pose stays at current value (no jump). */
  cancel(handle: AnimationHandle): void;
  /** Cancel every animation currently active under `key`. */
  cancelKey(key: string): void;
  /** Cancel everything. Useful from a destructor or "reset scene" path. */
  cancelAll(): void;
  /** True iff at least one animation is active. With `key`, scoped to that cancelKey. */
  isActive(key?: string): boolean;
  /**
   * True while the animator is currently executing an animation tick. Useful
   * for adapter wrappers (e.g. `animateOnSetPose`) that need to detect
   * "this `setPose` was called from inside another animation's onTick"
   * (momentum decay, in-flight tween, spring) and avoid recursively
   * scheduling a new wrap-animation that would fight the caller.
   */
  isTicking(): boolean;
}
