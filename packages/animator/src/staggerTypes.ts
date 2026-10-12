import type { EasingSpec } from '@weasel-js/geom';
import type { Target } from './target';
import type { TargetSpringOptions, TargetTweenOptions } from './targetTypes';
import type { AnimationHandle, Interpolate, InterpolatorFactory, SpringOptions } from './types';

/** A stagger run's own options: the factory form's fourth argument, and part
 *  of every fluent builder method's options. */
export interface StaggerOptions {
  /** Cancel-key for the supervising registration. `animator.cancelKey(key)`
   *  cancels the whole stagger; `animator.isActive(key)` returns true while
   *  any timer or child is alive. */
  cancelKey?: string;
  /** Names this stagger in {@link AnimatorEvent}s and `animator.live()`. */
  label?: string;
}

/** Per-index delay schedule. Number ⇒ `index * delay` ms. Function ⇒ caller
 *  decides the absolute delay for each index (e.g. `i => i * i * 30`). */
export type StaggerDelay = number | ((index: number) => number);

/** Produces the animation for one staggered item. */
export type StaggerFactory<TItem> = (item: TItem, index: number) => AnimationHandle;

/** A `T` value or a function that derives one from the per-item context. Used
 *  by the fluent builder methods (`.tween`, `.spring`) so each item can
 *  vary an option (e.g. `to: (_item, i) => (i + 1) * 10`). */
export type StaggerPerItem<T, TItem> = T | ((item: TItem, index: number) => T);

/** Options for the stagger builder's `.tween` in its `onTick` form: a tween per item, where
 *  `from`, `to` and `ms` may each vary by item. `cancelKey` and `label` belong
 *  to the stagger as a whole, as in {@link StaggerOptions}. */
export interface StaggerTweenOptions<T, TItem> extends StaggerOptions {
  /** Absent: this form hands values to `onTick`. {@link StaggerTargetTweenOptions} moves targets. */
  target?: undefined;
  from: StaggerPerItem<T, TItem>;
  to: StaggerPerItem<T, TItem>;
  ms: StaggerPerItem<number, TItem>;
  easing?: EasingSpec;
  interpolate?: Interpolate<T>;
  interpolator?: InterpolatorFactory<T>;
  onTick: (value: T, item: TItem, index: number) => void;
  onDone?: (item: TItem, index: number) => void;
}

/** Options for the stagger builder's `.spring` in its `onTick` form: a spring per item, where
 *  `from`, `to` and `velocity` may each vary by item. */
export interface StaggerSpringOptions<T, TItem> extends StaggerOptions,
  Pick<SpringOptions<T>, 'preset' | 'stiffness' | 'damping' | 'mass' | 'interpolate' | 'add' | 'subtract' | 'scale' | 'magnitude' | 'restThreshold'> {
  /** Absent: this form hands values to `onTick`. {@link StaggerTargetSpringOptions} moves targets. */
  target?: undefined;
  from: StaggerPerItem<T, TItem>;
  to: StaggerPerItem<T, TItem>;
  velocity?: StaggerPerItem<T, TItem>;
  onTick: (value: T, item: TItem, index: number) => void;
  onDone?: (item: TItem, index: number) => void;
}

/** What the stagger builder's methods share where each item's animation moves a {@link Target}. */
interface StaggerOnTarget<T, TItem> extends StaggerOptions {
  /** The target an item's animation moves: one for them all, or a function of the item.
   *  Default: the item itself, where the items are targets. */
  target?: StaggerPerItem<Target<T>, TItem>;
  /** Told an item's animation's own value each frame, as `TargetTweenOptions.onTick` is. */
  onTick?: (value: T, item: TItem, index: number) => void;
  onDone?: (item: TItem, index: number) => void;
}

/** Options for the stagger builder's `.tween` moving targets: `animator.tween`'s target form
 *  per item, where `to`, `from` and `ms` may each vary by item. The tweens share no
 *  `cancelKey`, so each adds to whatever else is moving its target. */
export interface StaggerTargetTweenOptions<T, TItem> extends StaggerOnTarget<T, TItem>,
  Pick<TargetTweenOptions<T>, 'easing' | 'interpolate' | 'interpolator'> {
  to: StaggerPerItem<T, TItem>;
  from?: StaggerPerItem<T, TItem>;
  ms: StaggerPerItem<number, TItem>;
}

/** Options for the stagger builder's `.spring` moving targets: `animator.spring`'s target
 *  form per item, where `to`, `from` and `velocity` may each vary by item. */
export interface StaggerTargetSpringOptions<T, TItem> extends StaggerOnTarget<T, TItem>,
  Pick<TargetSpringOptions<T>, 'preset' | 'stiffness' | 'damping' | 'mass' | 'restThreshold'> {
  to: StaggerPerItem<T, TItem>;
  from?: StaggerPerItem<T, TItem>;
  velocity?: StaggerPerItem<T, TItem>;
}

/** `.tween`'s options where the items are targets, each moved by its own tween. No options
 *  fit where they are not. */
export type StaggerItemTweenOptions<TItem> = TItem extends Target<infer T> ? StaggerTargetTweenOptions<T, TItem> : never;

/** `.spring`'s options where the items are targets, as {@link StaggerItemTweenOptions}. */
export type StaggerItemSpringOptions<TItem> = TItem extends Target<infer T> ? StaggerTargetSpringOptions<T, TItem> : never;

/** Narrows a builder method's target options to the call that names its `target`. */
type Naming = { target: NonNullable<unknown> };

/**
 * Fluent form of `Animator.stagger`: pick what to run per item after the
 * items and the delay schedule are already fixed.
 *
 * `.tween` and `.spring` each take three shapes of options. Where the items are targets, each
 * item's animation moves the item: `animator.stagger(targets, 80).spring({ to: (t) => ... })`.
 * With a `target`, it moves the target that names for the item. With neither, it hands its
 * values to `onTick`.
 */
export interface StaggerBuilder<TItem> {
  /** Run an arbitrary per-item factory. */
  each(factory: StaggerFactory<TItem>, opts?: StaggerOptions): AnimationHandle;
  /** Per-item `animator.tween` with per-item-varying options. */
  tween(opts: StaggerItemTweenOptions<TItem>): AnimationHandle;
  tween<T>(opts: StaggerTargetTweenOptions<T, TItem> & Naming): AnimationHandle;
  tween<T>(opts: StaggerTweenOptions<T, TItem>): AnimationHandle;
  /** Per-item `animator.spring` with per-item-varying options. */
  spring(opts: StaggerItemSpringOptions<TItem>): AnimationHandle;
  spring<T>(opts: StaggerTargetSpringOptions<T, TItem> & Naming): AnimationHandle;
  spring<T>(opts: StaggerSpringOptions<T, TItem>): AnimationHandle;
}
