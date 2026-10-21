import type { ColorOverrideRegistry } from './colorRegistry';
import type { EventTrack, TimelineEvent, TimelineHandle, TimelineOptions } from './timeline/types';
import type { EasingSpec, SpringPresetName } from '@weasel-js/geom';
import type { StaggerBuilder, StaggerDelay, StaggerFactory, StaggerOptions } from './staggerTypes';
import type {
  HoldHandle, HoldOptions, HoldRowsOptions, RowsHoldHandle, TargetDecayOptions, TargetPhysicsOptions, TargetSpringOptions, TargetTweenOptions,
} from './targetTypes';

export type { BezierEasing, EasingFn, EasingSpec, SpringPreset, SpringPresetName } from '@weasel-js/geom';
export type {
  HoldHandle, HoldOptions, HoldRowsOptions, RowsHoldHandle, TargetDecayOptions, TargetPhysicsOptions, TargetSpringOptions, TargetTweenOptions,
};
export type * from './staggerTypes';

/** Blends two `T` values at eased progress `t`. Called once per frame; see
 *  {@link InterpolatorFactory} when the blend has setup worth hoisting. */
export type Interpolate<T> = (from: T, to: T, t: number) => T;

/** Built ONCE at tween start with (from, to); the returned function is called with `t ∈ [0, 1]`
 *  each frame. Use for interpolators with expensive setup (color-space conversion, path-string
 *  parsing) — d3-interpolate's shape exactly. */
export type InterpolatorFactory<T> = (from: T, to: T) => (t: number) => T;


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
  /** Multiply this animation's virtual-clock rate by `scale`. 1 = normal, 0 holds it still, and
   *  below 0 plays it backward: run back to its start, it ends there holding its start value,
   *  as it ends holding its destination going forward, and `onDone` runs. */
  setTimeScale(scale: number): void;
  /** This animation's own time scale. 1 once it has finished, since the
   *  animator no longer holds an entry to read. */
  timeScale(): number;
  /** True iff this handle is currently paused. */
  isPaused(): boolean;
}

/** A duration-based animation from `from` to `to` over `ms`, shaped by an
 *  easing curve. Reach for a spring instead when the motion should respond to
 *  where the value already is rather than restart from a fixed duration. */
export interface TweenOptions<T> {
  /** Absent: this form hands values to `onTick`. The `Target` form of these options moves a target. */
  target?: undefined;
  from: T;
  to: T;
  ms: number;
  easing?: EasingSpec;
  /** Required when T is not `number`. For T = number, defaults to linear numeric lerp. */
  interpolate?: Interpolate<T>;
  /** Factory interpolator built once at tween start. Takes precedence over `interpolate`
   *  when both are provided. */
  interpolator?: InterpolatorFactory<T>;
  onTick: (value: T) => void;
  onDone?: () => void;
  /** Any new animation passed the same cancelKey cancels the prior one in flight. */
  cancelKey?: string;
  /** Names this animation in {@link AnimatorEvent}s and `animator.live()`. */
  label?: string;
}

/** A spring animation: runs until the value settles on `to` rather than for a
 *  set duration, so it absorbs an initial velocity naturally. Non-numeric `T`
 *  needs the four vector helpers. */
export interface SpringOptions<T> {
  /** Absent: this form hands values to `onTick`. The `Target` form of these options moves a target. */
  target?: undefined;
  from: T;
  to: T;
  /** Initial velocity in T-units per second. Default: zero (T-shape-aware). */
  velocity?: T;
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  interpolate?: Interpolate<T>;
  /** Vector helpers — required for non-numeric T. When `from`, `to` and `velocity` are numbers, number
   *  arrays or plain objects of numeric fields of one shape, and stiffness, damping and mass are
   *  positive, the motion is solved in closed form and these only decide when it has come to rest —
   *  a `subtract` that wraps an angle won't change the path. */
  add?: (a: T, b: T) => T;
  subtract?: (a: T, b: T) => T;
  scale?: (v: T, k: number) => T;
  magnitude?: (v: T) => number;
  /** Velocity magnitude below which the spring is considered settled. Default 0.01. */
  restThreshold?: number;
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
  /** Names this animation in {@link AnimatorEvent}s and `animator.live()`. */
  label?: string;
}

/** Spring and decay as one animation. With a `to`, a spring pulls toward it;
 *  with `to: null`, the value coasts on its velocity. Either can become the
 *  other mid-flight through the handle. */
export interface PhysicsOptions<T> {
  /** Absent: this form hands values to `onTick`. The `Target` form of these options moves a target. */
  target?: undefined;
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
  /** Vector helpers — required for non-numeric T. When `from`, `to` and `velocity` are numbers, number
   *  arrays or plain objects of numeric fields of one shape, and stiffness, damping and mass are
   *  positive, the motion is solved in closed form and these only decide when it has come to rest —
   *  a `subtract` that wraps an angle won't change the path. */
  add?: (a: T, b: T) => T;
  subtract?: (a: T, b: T) => T;
  scale?: (v: T, k: number) => T;
  magnitude?: (v: T) => number;
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
  /** Names this animation in {@link AnimatorEvent}s and `animator.live()`. */
  label?: string;
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
  /** Absent: this form hands values to `onTick`. The `Target` form of these options moves a target. */
  target?: undefined;
  from: T;
  velocity: T;
  /** Per-second velocity multiplier in (0, 1). Default 0.95. */
  friction?: number;
  /** Velocity magnitude below which decay stops. Default 0.5. */
  threshold?: number;
  /** When `from` and `velocity` are numbers, number arrays or plain objects of numeric fields of one
   *  shape and `friction` is below 1, the motion is solved in closed form: `add` and `scale` go
   *  unused and `magnitude` only decides when it has come to rest. */
  add: (a: T, b: T) => T;
  scale: (v: T, k: number) => T;
  magnitude: (v: T) => number;
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
  /** Names this animation in {@link AnimatorEvent}s and `animator.live()`. */
  label?: string;
}

/** Options for `useAnimator`. Everything here is an injection seam for tests;
 *  the defaults are the real clock and rAF. */
export interface UseAnimatorOptions {
  /** Optional clock injection for tests. Returns ms since some epoch. */
  now?: () => number;
  /** Optional rAF / cAF injection for tests. Defaults to window.requestAnimationFrame. */
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

/**
 * Owns every running animation on a canvas and drives them from one rAF loop.
 * Beyond the primitives (`tween`, `spring`, `decay`, `physics`) it offers
 * composition — `loop`, `stagger` — and bulk control by handle, by cancel-key,
 * or over everything at once.
 *
 * An animator does not know about the scene. An animation either reports values
 * through `onTick` and the caller decides what to do with them, or moves a
 * {@link Target}, where several on one target add.
 */
export interface Animator {
  tween<T>(opts: TweenOptions<T> | TargetTweenOptions<T>): AnimationHandle;
  spring<T>(opts: SpringOptions<T> | TargetSpringOptions<T>): AnimationHandle;
  decay<T>(opts: DecayOptions<T> | TargetDecayOptions<T>): AnimationHandle;
  /** With `to` set, behaves as a spring; with `to: null`, as a velocity-driven decay.
   *  Retarget mid-flight via the returned handle's `setTarget`. */
  physics<T>(opts: PhysicsOptions<T> | TargetPhysicsOptions<T>): PhysicsHandle<T>;
  /** Shows a value on a {@link Target} in place of its committed one until canceled or released.
   *  It covers an animation's move to a destination; a coast, push, or `from` offset adds on top. */
  hold<T>(opts: HoldOptions<T>): HoldHandle;
  /** Holds rows of a target table at values and weights the caller writes into flat arrays: a
   *  hold on each row, as `hold` would put there, with no function asked for any of them. */
  holdRows(opts: HoldRowsOptions): RowsHoldHandle;
  /** Cancel a specific animation by handle. Pose stays at current value (no jump). */
  cancel(handle: AnimationHandle): void;
  /** Cancel every animation currently active under `key`. */
  cancelKey(key: string): void;
  /** Cancel everything. Useful from a destructor or "reset scene" path. */
  cancelAll(): void;
  /** True iff at least one animation is active. With `key`, scoped to that cancelKey. */
  isActive(key?: string): boolean;
  /**
   * True while the animator is executing an animation tick. Lets an adapter wrapper detect a
   * `setPose` called from inside another animation's onTick and avoid scheduling a new
   * animation that would fight the caller.
   */
  isTicking(): boolean;
  /** Freeze every animation managed by this animator. */
  pause(): void;
  /** Resume every animation managed by this animator. */
  resume(): void;
  /** True iff the animator is currently globally paused. */
  isPaused(): boolean;
  /** Multiply every animation's virtual-clock rate by `scale`. Below 0 plays every one backward,
   *  as each handle's `setTimeScale` does, while the animator's own clock goes on forward: one
   *  started meanwhile is at its start already, and ends at once. */
  setTimeScale(scale: number): void;
  /** The global time scale. Per-animation scales multiply on top of it. */
  timeScale(): number;
  /** Freeze every animation whose `cancelKey` matches. */
  pauseKey(key: string): void;
  /** Resume every animation whose `cancelKey` matches. */
  resumeKey(key: string): void;
  /** Set per-animation timeScale for every animation whose `cancelKey` matches. */
  setTimeScaleByKey(key: string, scale: number): void;
  /**
   * Repeatedly invokes `factory` to produce a child animation. The factory must wire its
   * returned handle's `onDone` to call `next` so the loop advances. The returned handle's
   * pause/resume/setTimeScale/cancel delegate to the in-flight child, and
   * `animator.cancel(handle)`, `animator.cancelKey(opts.cancelKey)`, and
   * `animator.isActive(opts.cancelKey)` all work for it.
   */
  loop(factory: LoopFactory, opts?: LoopOptions): AnimationHandle;
  /** Sugar over `loop`: a tween between two values, repeated per `direction`. Registered
   *  with the animator like `loop`. */
  tweenLoop<T>(opts: TweenLoopOptions<T>): AnimationHandle;
  /**
   * Schedules a per-item animation, offset by `delay` ms per index (or a custom function of
   * the index). Pass `factory` and get a composite `AnimationHandle`; omit it and get a
   * `StaggerBuilder` for fluent `.each` / `.tween` / `.spring` calls, the last two of which
   * move the items themselves where they are targets.
   *
   * The composite handle's `cancel` cancels the items still waiting AND the in-flight
   * children. The delays run on the animator's clock, not the wall's: a pause or a time
   * scale holds or stretches the waiting items along with the children, and a hidden tab
   * holds both. `animator.cancel(handle)`, `animator.cancelKey(opts.cancelKey)`, and
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
  /** Per-node, per-channel color override registry, painted onto scene nodes by
   *  `<SceneCanvas animator>` and read by `createPathLayer`. Only this animator can move its
   *  per-node targets. Cleared automatically on animator unmount. */
  colorOverrides: ColorOverrideRegistry;
  /**
   * Subscribe to a callback fired once per RAF frame while any animation is active; returns
   * an unsubscribe. For consumers that repaint from a non-scene channel such as
   * `colorOverrides`, whose writes do not trigger a repaint the way scene mutations do.
   * Fires AFTER the frame's animations have ticked.
   */
  onTick(cb: () => void): () => void;
  /**
   * Keeps the animator's RAF loop running until the returned cancel function is called. For
   * effects read on every frame that have no progress state of their own; without it the
   * loop would idle and `onTick` would stop firing.
   */
  keepAlive(): () => void;
  /**
   * Subscribe to the lifecycle of every animation this animator runs, the
   * composites and timelines included. Returns an unsubscribe. Events arrive
   * synchronously, as each thing happens — see {@link AnimatorEvent} for the
   * order. With no listener attached nothing is built or delivered, so an
   * unwatched animator pays nothing for this.
   */
  watch(listener: AnimatorListener): () => void;
  /** What is running right now, in registration order: a fresh snapshot per
   *  call, for a debug overlay to draw. */
  live(): LiveAnimation[];
}

/** Which animator call started an animation. A loop, tween loop or stagger is
 *  an entry of its own beside the children it runs; `keepAlive` holds the
 *  frame loop open and animates nothing. */
export type AnimationKind =
  | 'tween' | 'spring' | 'decay' | 'physics' | 'timeline'
  | 'loop' | 'tweenLoop' | 'stagger' | 'keepAlive' | 'hold';

/** Who an {@link AnimatorEvent} is about. One object per registration, so the
 *  same animation's events share it by identity. */
export interface AnimationInfo {
  /** The id on the animation's handle. */
  readonly id: number;
  readonly kind: AnimationKind;
  /** The animation's `cancelKey`. Pose helpers key by node, as `pose:<id>`. */
  readonly key?: string;
  /** The animation's `label` option. */
  readonly label?: string;
}

/** One row of `animator.live()`. */
export interface LiveAnimation extends AnimationInfo {
  /** Paused on its own handle. The animator-wide pause is `animator.isPaused()`. */
  readonly paused: boolean;
  /** Its own time scale; the animator's multiplies on top. */
  readonly timeScale: number;
  /** Virtual ms its clock has advanced since it started. */
  readonly elapsed: number;
  /** 0 to 1, for a tween or a timeline (the playhead over its duration).
   *  Absent where there is no end to measure against: physics, composites. */
  readonly progress?: number;
}

/**
 * One thing happening to an animation, as `animator.watch` delivers it.
 *
 * - `start` — registered. A finished timeline that `seek` or `edit` revives
 *   starts again, under the same id.
 * - `end` — finished on its own. Delivered once every animation has ticked
 *   that frame, in registration order.
 * - `cancel` — stopped by its handle, `cancel`, `cancelKey` or `cancelAll`.
 * - `interrupt` — stopped because `by` claimed its `cancelKey`. Delivered
 *   before `by`'s `start`.
 * - `error` — its tick threw (an `onTick`, `onDone` or interpolator), so it was
 *   taken off the table, after the frame's other animations ticked. In place of
 *   `cancel`, or after `end` when `onDone` threw. The error is also logged.
 * - `lap` — a looping timeline wrapped; `lap` counts wraps since it started.
 * - `fire` — an event on a timeline's event track was crossed, at any depth.
 *   `path` indexes from the root timeline's `tracks()` down through each
 *   nested timeline to the event track. Delivered after the event's own `fire`.
 */
export type AnimatorEvent =
  | { readonly type: 'start' | 'end' | 'cancel'; readonly animation: AnimationInfo }
  | { readonly type: 'interrupt'; readonly animation: AnimationInfo; readonly by: AnimationInfo }
  | { readonly type: 'error'; readonly animation: AnimationInfo; readonly error: unknown }
  | { readonly type: 'lap'; readonly animation: AnimationInfo; readonly lap: number }
  | {
    readonly type: 'fire';
    readonly animation: AnimationInfo;
    readonly track: EventTrack;
    readonly path: readonly number[];
    readonly event: TimelineEvent;
    /** As the event's own `fire` is told: ms behind the frame it was crossed. */
    readonly lateBy: number;
  };

/** Receives what `animator.watch` delivers. */
export type AnimatorListener = (event: AnimatorEvent) => void;

/** Options for `Animator.loop`. */
export interface LoopOptions {
  /** Maximum number of iterations. Default Infinity. */
  count?: number;
  /** Invoked when the loop reaches `count` iterations naturally (not on cancel). */
  onDone?: () => void;
  /** Any new animation passed the same cancelKey cancels the prior one in flight.
   *  Also enables `animator.cancelKey` / `animator.isActive(key)` for this loop. */
  cancelKey?: string;
  /** Names this loop in {@link AnimatorEvent}s and `animator.live()`. */
  label?: string;
}

/** Produces one iteration of a loop. Must arrange for `next` to be called when
 *  the animation it returns finishes, or the loop stalls after one pass. */
export type LoopFactory = (iteration: number, next: () => void) => AnimationHandle;

/** Options for `Animator.tweenLoop` — a tween's options plus how each
 *  iteration relates to the last. */
export interface TweenLoopOptions<T> {
  from: T;
  to: T;
  ms: number;
  easing?: EasingSpec;
  /** `restart` (default): from→to every iteration.
   *  `reverse`: to→from every iteration.
   *  `alternate`: even iterations from→to, odd iterations to→from. */
  direction?: 'restart' | 'reverse' | 'alternate';
  count?: number;
  interpolate?: Interpolate<T>;
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
  /** Names this animation in {@link AnimatorEvent}s and `animator.live()`. */
  label?: string;
}
