import type { ColorOverrideRegistry } from './colorRegistry';
import type { TimelineHandle, TimelineOptions } from './timeline/types';

/** An easing curve: maps normalized progress `t ∈ [0, 1]` to eased progress.
 *  Curves may leave the 0–1 range in the middle (back, elastic) but should
 *  pass through 0 at 0 and 1 at 1. */
export type EasingFn = (t: number) => number;

/** Blends two `T` values at eased progress `t`. Called once per frame; see
 *  {@link InterpolatorFactory} when the blend has setup worth hoisting. */
export type Interpolate<T> = (from: T, to: T, t: number) => T;

/** Factory interpolator: built ONCE at tween start with (from, to), the returned
 *  function is called with `t ∈ [0, 1]` each frame. Use for interpolators with
 *  expensive setup (color-space conversion, path-string parsing) — d3-interpolate's
 *  shape exactly. For cheap interpolations the per-tick `Interpolate<T>` form is
 *  fine; this is the escape hatch when setup-per-tick is wasteful. */
export type InterpolatorFactory<T> = (from: T, to: T) => (t: number) => T;

/** A spring's physical parameters. Higher stiffness settles faster, higher
 *  damping overshoots less, higher mass makes both sluggish. */
export interface SpringPreset {
  stiffness: number;
  damping: number;
  mass: number;
}

/** One of the tunings in `SPRING_PRESETS`. */
export type SpringPresetName = 'gentle' | 'wobbly' | 'stiff' | 'slow';

/** A running animation. Cancel it, or bend its time — pausing and time-scaling
 *  act on this animation's own virtual clock, independent of the animator's. */
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

/** A duration-based animation from `from` to `to` over `ms`, shaped by an
 *  easing curve. Reach for a spring instead when the motion should respond to
 *  where the value already is rather than restart from a fixed duration. */
export interface TweenOptions<T> {
  from: T;
  to: T;
  ms: number;
  easing?: EasingFn;
  /** Required when T is not `number`. For T = number, defaults to linear numeric lerp.
   *  Called per-tick with `(from, to, t)`. For interpolators with expensive setup,
   *  prefer `interpolator` which is built once at tween start. */
  interpolate?: Interpolate<T>;
  /** Factory interpolator built once at tween start. Takes precedence over
   *  `interpolate` when both are provided. Use this for d3-interpolate or any
   *  `(from, to) => (t) => v` shape. */
  interpolator?: InterpolatorFactory<T>;
  onTick: (value: T) => void;
  onDone?: () => void;
  /** Any new animation passed the same cancelKey cancels the prior one in flight. */
  cancelKey?: string;
}

/** A spring animation: runs until the value settles on `to` rather than for a
 *  set duration, so it absorbs an initial velocity naturally. Non-numeric `T`
 *  needs the four vector helpers. */
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

/** Spring and decay as one animation. With a `to`, a spring pulls toward it;
 *  with `to: null`, the value coasts on its velocity. Either can become the
 *  other mid-flight through the handle. */
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

/** An `AnimationHandle` that can also be steered while it runs — the point of
 *  the physics primitive. */
export interface PhysicsHandle<T = unknown> extends AnimationHandle {
  /** Retarget mid-flight. `null` ⇒ switch to decay-mode (no spring force). */
  setTarget(to: T | null): void;
  /** Replace the current velocity in T-units per second. */
  setVelocity(v: T): void;
}

/** Momentum: coast from `from` at `velocity`, slowing by `friction` each
 *  second until below `threshold`. What a flick-to-pan leaves behind. */
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

/** Options for `useAnimator`. Everything here is an injection seam for tests;
 *  the defaults are the real clock, rAF, and `setTimeout`. */
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

/**
 * Owns every running animation on a canvas and drives them from one rAF loop.
 * Beyond the primitives (`tween`, `spring`, `decay`, `physics`) it offers
 * composition — `loop`, `stagger` — and bulk control by handle, by cancel-key,
 * or over everything at once.
 *
 * An animator does not know about the scene: animations report values through
 * `onTick` and the caller decides what to do with them.
 */
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
   * The loop is registered with the animator under a supervisor entry so
   * `animator.cancel(handle)`, `animator.cancelKey(opts.cancelKey)`, and
   * `animator.isActive(opts.cancelKey)` all work for it.
   */
  loop(factory: LoopFactory, opts?: LoopOptions): AnimationHandle;
  /** Sugar over `loop` for the common case of looping a tween between two
   *  values with optional direction handling (`restart` | `reverse` |
   *  `alternate`). Registered with the animator like `loop`. */
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
   * children; `pause`/`resume` also freeze and thaw pending per-item timers
   * (the remaining time before each pending fire is preserved across the
   * pause).
   *
   * The stagger is registered with the animator under a supervisor entry so
   * `animator.cancel(handle)`, `animator.cancelKey(opts.cancelKey)`, and
   * `animator.isActive(opts.cancelKey)` all work for it.
   */
  stagger<TItem>(items: readonly TItem[], delay: StaggerDelay): StaggerBuilder<TItem>;
  stagger<TItem>(
    items: readonly TItem[],
    delay: StaggerDelay,
    factory: StaggerFactory<TItem>,
    opts?: StaggerOptions,
  ): AnimationHandle;
  /**
   * Keyframe timeline. Registered like any other animation, so its playhead
   * responds to `pause`, `setTimeScale` and `cancelKey`. Sampled tracks are a
   * pure function of the playhead; event tracks fire only on forward playback.
   */
  timeline(opts: TimelineOptions): TimelineHandle;
  /** Per-node, per-channel color override registry consulted by the renderer's
   *  path layer before reading consumer accessors. Used by `tweenVertexColors`,
   *  `springVertexColors`, `cycleVertexColors`, `staggerVertexColors`. Cleared
   *  automatically on animator unmount. */
  colorOverrides: ColorOverrideRegistry;
  /**
   * Subscribe to a callback fired once per RAF frame while any animation is
   * active. Returns an unsubscribe function. Used by consumers (typically
   * `<SceneCanvas>`) that need to repaint when an animation's side-effect
   * is read from a non-scene channel (e.g. `colorOverrides` consulted from
   * a custom `drawOne`) — scene mutations naturally trigger a repaint, but
   * `colorOverrides` writes do not.
   *
   * The callback fires AFTER the per-frame tick of each registered
   * animation, so by the time it runs `colorOverrides.get(...)` returns
   * the latest values. If no animations are active, no tick fires.
   */
  onTick(cb: () => void): () => void;
  /**
   * Keep the animator's RAF loop running until the returned cancel
   * function is called. Use for animations whose effect is read on every
   * frame but which don't have a natural progress state (e.g.
   * `cycleVertexColors`, which expresses its current value as a function
   * of `performance.now()` rather than as a tween from `from` to `to`).
   * Without a keep-alive entry the loop would idle and `onTick` would
   * stop firing even though the override is still installed.
   */
  keepAlive(): () => void;
}

/** Options for `Animator.loop`. */
export interface LoopOptions {
  /** Maximum number of iterations. Default Infinity. */
  count?: number;
  /** Invoked when the loop reaches `count` iterations naturally (not on cancel). */
  onDone?: () => void;
  /** Any new animation passed the same cancelKey cancels the prior one in flight.
   *  Also enables `animator.cancelKey` / `animator.isActive(key)` for this loop. */
  cancelKey?: string;
}

/** Options for the top-level `Animator.stagger` factory form (third overload). */
export interface StaggerOptions {
  /** Cancel-key for the supervising registration. `animator.cancelKey(key)`
   *  cancels the whole stagger; `animator.isActive(key)` returns true while
   *  any timer or child is alive. */
  cancelKey?: string;
}

/** Produces one iteration of a loop. Must arrange for `next` to be called when
 *  the animation it returns finishes, or the loop stalls after one pass. */
export type LoopFactory = (iteration: number, next: () => void) => AnimationHandle;

/** Per-index delay schedule. Number ⇒ `index * delay` ms. Function ⇒ caller
 *  decides the absolute delay for each index (e.g. `i => i * i * 30`). */
export type StaggerDelay = number | ((index: number) => number);

/** Produces the animation for one staggered item. */
export type StaggerFactory<TItem> = (item: TItem, index: number) => AnimationHandle;

/** A `T` value or a function that derives one from the per-item context. Used
 *  by the fluent builder methods (`.tween`, `.springPose`) so each item can
 *  vary an option (e.g. `to: (_item, i) => (i + 1) * 10`). */
export type StaggerPerItem<T, TItem> = T | ((item: TItem, index: number) => T);

/** Options for the stagger builder's `.tween`: a tween per item, where
 *  `from`, `to` and `ms` may each vary by item. */
export interface StaggerTweenOptions<T, TItem> {
  from: StaggerPerItem<T, TItem>;
  to: StaggerPerItem<T, TItem>;
  ms: StaggerPerItem<number, TItem>;
  easing?: EasingFn;
  interpolate?: Interpolate<T>;
  onTick: (value: T, item: TItem, index: number) => void;
  onDone?: (item: TItem, index: number) => void;
}

/** Options for the stagger builder's `.springPose`: the spring tuning, and
 *  whether each item's settle is recorded as an undoable op. */
export interface StaggerSpringPoseOptions<TPose> {
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  geometry?: import('interactions/actions/resize/geometry').PoseProjection<TPose>;
  recordOp?: boolean;
  opLabel?: string;
}

/** Fluent form of `Animator.stagger`: pick what to run per item after the
 *  items and the delay schedule are already fixed. */
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

/** Options for `Animator.tweenLoop` — a tween's options plus how each
 *  iteration relates to the last. */
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
  cancelKey?: string;
}
