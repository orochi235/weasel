import type { EasingSpec, SpringPresetName } from '@weasel-js/geom';
import type { AxisRef } from './axisNames';
import type { Target } from './target';
import type { ShownArray, TargetTable } from './targetTable';
import type { AnimationHandle, Interpolate, InterpolatorFactory } from './types';

/** What every animation on a {@link Target} takes. */
interface OnTarget<T> {
  /** The value to move. */
  target: Target<T>;
  /** Told this animation's own value each frame: its destination plus what it has left to travel. */
  onTick?: (value: T) => void;
  onDone?: () => void;
  /** Any new animation passed the same cancelKey cancels the prior one in flight. Leave it off
   *  to let animations on one target add. */
  cancelKey?: string;
  /** False to take `cancelKey` without canceling the animations holding it, so it adds to them
   *  and `cancelKey`, `pauseKey`, and `isActive` reach them all. Default true. */
  interrupt?: boolean;
  /** Names this animation in {@link AnimatorEvent}s and `animator.live()`. */
  label?: string;
}

/** A tween on a {@link Target}. `to` is committed as it starts, and it contributes what is left
 *  to travel, so it adds to whatever else is moving the target. */
export interface TargetTweenOptions<T> extends OnTarget<T> {
  to: T;
  /** Where its own travel starts. Default: the target's committed value, so the value on screen
   *  does not move as it starts. */
  from?: T;
  ms: number;
  easing?: EasingSpec;
  /** The path from `from` to `to`, where a straight line per axis is not it. */
  interpolate?: Interpolate<T>;
  /** As `interpolate`, built once at the start. Takes precedence. */
  interpolator?: InterpolatorFactory<T>;
}

/** A spring on a {@link Target}. Needs positive stiffness, damping and mass. Interrupting an
 *  animation on the same target under the same `cancelKey`, it starts at that one's velocity
 *  unless given its own. */
export interface TargetSpringOptions<T> extends OnTarget<T> {
  to: T;
  /** As {@link TargetTweenOptions.from}. */
  from?: T;
  /** Initial velocity in T-units per second. */
  velocity?: T;
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  /** Distance from `to` and speed, both in axis units, under which it has come to rest. Default 0.01. */
  restThreshold?: number;
}

/** Spring and coast as one animation on a {@link Target}. With `to: null` it coasts on its
 *  velocity, committing where it is when it stops. */
export interface TargetPhysicsOptions<T> extends Omit<TargetSpringOptions<T>, 'to'> {
  to?: T | null;
}

/** What `animator.hold` takes. */
export interface HoldOptions<T> {
  /** The value to hold. */
  target: Target<T>;
  /** What to show in place of the committed value: a value, or a function read each frame.
   *  A value is read as the hold starts and again at `touch()`, and costs a frame nothing. */
  value: T | (() => T);
  /** Its share among the target's holds, 0 to 1: a number, or a function read each frame.
   *  Default 1. Holds on one target show their weighted average, and whatever their weights
   *  leave short of 1 is the committed value's. */
  weight?: number | (() => number);
  /**
   * The axes of the target it holds, each by name or by index: a plain object's fields
   * (`['y']`), a rig's joints (`['armL', 'foreL']`) or one of a joint's own
   * (`['armL.rotation']`), as `target.axisIndexes` resolves them when the hold starts. The
   * rest are left to the target's other holds and its committed value, and a release commits
   * only these. Default: every axis.
   */
  axes?: readonly AxisRef<T>[];
  /** Any new animation passed the same cancelKey cancels this one. */
  cancelKey?: string;
  /** Names this hold in {@link AnimatorEvent}s and `animator.live()`. */
  label?: string;
  /** With `false`, it takes its `cancelKey` without canceling whoever holds it. Default true. */
  interrupt?: boolean;
}

/** What `animator.hold` returns. `cancel` commits what the hold was showing, as `release()`
 *  does; pausing it or scaling its time changes nothing, since it has no clock. */
export interface HoldHandle extends AnimationHandle {
  /** Says a function-form `value` or `weight` changed outside a frame, so the target shows it
   *  now rather than at the next frame the animator happens to run. A `value` given as an
   *  object and then written in place shows only once this is called. */
  touch(): void;
  /** Ends the hold. By default it commits the value it was showing, so the target stays where
   *  it is; with `commit: false` the committed value is left alone and the target falls back
   *  to it. */
  release(opts?: { commit?: boolean }): void;
}

/** What `animator.holdRows` takes. */
export interface HoldRowsOptions {
  /** The table whose rows it holds. */
  table: TargetTable<ShownArray>;
  /** The rows to hold. Default: every row the table has as the hold starts. */
  rows?: ArrayLike<number>;
  /** The weight each row starts at, 0 to 1. Default 1. */
  weight?: number;
  /** The axes of each row it holds, by index. Default: all of them. */
  axes?: readonly number[];
  /** Any new animation passed the same cancelKey cancels this one. */
  cancelKey?: string;
  /** Names it in {@link AnimatorEvent}s and `animator.live()`. */
  label?: string;
  /** With `false`, it takes its `cancelKey` without canceling whoever holds it. Default true. */
  interrupt?: boolean;
}

/**
 * What `animator.holdRows` returns: a hold on each of its rows, which shows that row's value in
 * `values` at its weight in `weights`, mixed with the row's other holds as `hold`'s are. Write
 * either in place and call `touch()`. A row stopped through its target, or removed from the
 * table, is let go of; the rest stay held until the hold is released or canceled, each
 * committing what it showed, as `release()` does.
 */
export interface RowsHoldHandle extends HoldHandle {
  /** Each row's value to hold, laid out as `table.committed`: row `r` at `r * table.axes`.
   *  A held row starts at its committed value. A new array once the table grows. */
  readonly values: Float64Array;
  /** Each held row's weight, 0 to 1, row `r` at `r`. A new array once the table grows. */
  readonly weights: Float64Array;
}

/** A coast on a {@link Target}: it commits where it stops. */
export interface TargetDecayOptions<T> extends OnTarget<T> {
  /** As {@link TargetTweenOptions.from}. */
  from?: T;
  velocity: T;
  /** Per-second velocity multiplier in (0, 1). Default 0.95. */
  friction?: number;
  /** Speed below which it stops. Default 0.5. */
  threshold?: number;
}
