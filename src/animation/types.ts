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

export interface PhysicsOptions<T> {
  from: T;
  /** Target. `null` ⇒ no spring force (decay-mode). */
  to?: T | null;
  /** Initial velocity in T-units per second. */
  velocity?: T;
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  restThreshold?: number;
  /** Vector helpers — required for non-numeric T. */
  add?: (a: T, b: T) => T;
  subtract?: (a: T, b: T) => T;
  scale?: (v: T, k: number) => T;
  magnitude?: (v: T) => number;
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
}

export interface PhysicsHandle<T = unknown> extends AnimationHandle {
  /** Retarget mid-flight. `null` ⇒ switch to decay-mode (no spring force). */
  setTarget(to: T | null): void;
  /** Replace the current velocity in T-units per second. */
  setVelocity(v: T): void;
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
  /** Optional `setTimeout` injection used by `stagger` for per-item delays.
   *  Defaults to the global `setTimeout`. Tests inject a virtual scheduler. */
  setTimer?: (cb: () => void, ms: number) => unknown;
  /** Companion to `setTimer`. Defaults to global `clearTimeout`. */
  clearTimer?: (handle: unknown) => void;
}

export interface Animator {
  tween<T>(opts: TweenOptions<T>): AnimationHandle;
  spring<T>(opts: SpringOptions<T>): AnimationHandle;
  decay<T>(opts: DecayOptions<T>): AnimationHandle;
  /** Unified spring/decay primitive. With `to` set, behaves as a spring;
   *  with `to: null`, behaves as a velocity-driven decay. Supports
   *  mid-flight retargeting via the returned handle's `setTarget`. */
  physics<T>(opts: PhysicsOptions<T>): PhysicsHandle<T>;
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
  /** Freeze every animation managed by this animator. */
  pause(): void;
  /** Resume every animation managed by this animator. */
  resume(): void;
  /** True iff the animator is currently globally paused. */
  isPaused(): boolean;
  /** Multiply every animation's virtual-clock rate by `scale`. 1 = normal. */
  setTimeScale(scale: number): void;
  /** Freeze every animation whose `cancelKey` matches. */
  pauseKey(key: string): void;
  /** Resume every animation whose `cancelKey` matches. */
  resumeKey(key: string): void;
  /** Set per-animation timeScale for every animation whose `cancelKey` matches. */
  setTimeScaleByKey(key: string, scale: number): void;
  /**
   * Loop primitive: repeatedly invoke `factory` to produce a child animation.
   * The factory must wire its returned handle's `onDone` to call `next` so
   * the loop advances. Returns a handle whose pause/resume/setTimeScale/cancel
   * delegate to the current in-flight child (and prevent future iterations
   * on cancel).
   *
   * NOTE: The returned handle is NOT registered in the animator's id table.
   * `animator.cancel(handle)` and `animator.cancelKey(...)` will not stop a
   * loop. Cancel via `handle.cancel()` directly.
   */
  loop(factory: LoopFactory, opts?: LoopOptions): AnimationHandle;
  /** Sugar over `loop` for the common case of looping a tween between two
   *  values with optional direction handling (`restart` | `reverse` |
   *  `alternate`).
   *
   *  NOTE: Same registry caveat as `loop` — the returned handle is not
   *  registered with the animator. Cancel via `handle.cancel()` directly. */
  tweenLoop<T>(opts: TweenLoopOptions<T>): AnimationHandle;
  /**
   * Stagger primitive: schedule a per-item animation, offset by `delay` ms
   * per index (or a custom function of the index). Two forms:
   *   - Factory form: pass `factory` directly, returns a composite
   *     `AnimationHandle`.
   *   - Builder form: omit `factory`, get a `StaggerBuilder` for fluent
   *     `.each` / `.tween` / `.springPose` calls.
   *
   * The composite handle's `cancel` cancels pending timers AND in-flight
   * children. `pause` / `resume` / `setTimeScale` propagate to in-flight
   * children only (pending timers are not pausable in v1).
   *
   * NOTE: Same registry caveat as `loop` — the returned composite handle is
   * NOT registered with the animator's id table. `animator.cancel(handle)`
   * and `animator.cancelKey(...)` will not stop a stagger. Cancel via
   * `handle.cancel()` directly.
   */
  stagger<TItem>(items: readonly TItem[], delay: StaggerDelay): StaggerBuilder<TItem>;
  stagger<TItem>(
    items: readonly TItem[],
    delay: StaggerDelay,
    factory: StaggerFactory<TItem>,
  ): AnimationHandle;
}

export interface LoopOptions {
  /** Maximum number of iterations. Default Infinity. */
  count?: number;
  /** Invoked when the loop reaches `count` iterations naturally (not on cancel). */
  onDone?: () => void;
}

export type LoopFactory = (iteration: number, next: () => void) => AnimationHandle;

/** Per-index delay schedule. Number ⇒ `index * delay` ms. Function ⇒ caller
 *  decides the absolute delay for each index (e.g. `i => i * i * 30`). */
export type StaggerDelay = number | ((index: number) => number);

export type StaggerFactory<TItem> = (item: TItem, index: number) => AnimationHandle;

/** A `T` value or a function that derives one from the per-item context. Used
 *  by the fluent builder methods (`.tween`, `.springPose`) so each item can
 *  vary an option (e.g. `to: (_item, i) => (i + 1) * 10`). */
export type StaggerPerItem<T, TItem> = T | ((item: TItem, index: number) => T);

export interface StaggerTweenOptions<T, TItem> {
  from: StaggerPerItem<T, TItem>;
  to: StaggerPerItem<T, TItem>;
  ms: StaggerPerItem<number, TItem>;
  easing?: EasingFn;
  interpolate?: Interpolate<T>;
  onTick: (value: T, item: TItem, index: number) => void;
  onDone?: (item: TItem, index: number) => void;
}

export interface StaggerSpringPoseOptions<TPose> {
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  geometry?: import('interactions/gestures/resize/geometry').PoseDescriptor<TPose>;
  recordOp?: boolean;
  opLabel?: string;
}

export interface StaggerBuilder<TItem> {
  /** Run an arbitrary per-item factory. */
  each(factory: StaggerFactory<TItem>): AnimationHandle;
  /** Sugar: per-item `animator.tween` with per-item-varying options. */
  tween<T>(opts: StaggerTweenOptions<T, TItem>): AnimationHandle;
  /** Sugar: per-item `springPose` against an adapter. `poseFn` returns the
   *  target pose for each item. Each item must either be a primitive
   *  (string/number) or expose a string `id` field — otherwise pose ids
   *  would collide on `"[object Object]"` and successive tweens would
   *  cancel each other. Throws on items that satisfy neither. */
  springPose<TPose>(
    adapter: import('core/adapters/types').SceneAdapter<{ id: string }, TPose>,
    poseFn: (item: TItem, index: number) => TPose,
    opts?: StaggerSpringPoseOptions<TPose>,
  ): AnimationHandle;
}

export interface TweenLoopOptions<T> {
  from: T;
  to: T;
  ms: number;
  easing?: EasingFn;
  /** `restart` (default): from→to every iteration.
   *  `reverse`: to→from every iteration.
   *  `alternate`: even iterations from→to, odd iterations to→from. */
  direction?: 'restart' | 'reverse' | 'alternate';
  count?: number;
  interpolate?: Interpolate<T>;
  onTick: (value: T) => void;
  onDone?: () => void;
}
