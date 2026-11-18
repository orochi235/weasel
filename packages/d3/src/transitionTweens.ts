import type { NodeId } from '@weasel-js/core';
import type { Animator, AnimationHandle, EasingFn } from '@weasel-js/animator';
import { lerp } from '@weasel-js/geom';

/** A `.tween()` registered on a transition. */
export interface CustomTween<TData> {
  name: string;
  from: (d: TData, i: number) => unknown;
  to: (d: TData, i: number) => unknown;
  interpolate?: (from: unknown, to: unknown) => (t: number) => unknown;
  apply: (d: TData, id: NodeId, value: unknown) => void;
}

/** A transition's duration and ease, read when each tween spawns. */
export interface TweenTiming {
  readonly duration: number;
  readonly easing: EasingFn | undefined;
}

/** One tween an item runs: started with what to call when it finishes, returning its handle. */
export type TweenJob = (done: () => void) => AnimationHandle;

/** The job tweening a node's pose from `from` to `to`, calling `onTick` with each pose. */
export function poseTweenJob<TPose>(
  animator: Animator,
  timing: TweenTiming,
  cancelKey: string,
  from: TPose,
  to: TPose,
  lerpPose: (a: TPose, b: TPose, t: number) => TPose,
  onTick: (pose: TPose) => void,
): TweenJob {
  return (done) => animator.tween<TPose>({
    from,
    to,
    ms: timing.duration,
    easing: timing.easing,
    cancelKey,
    interpolate: (a, b, t) => (t === 1 ? b : t === 0 ? a : lerpPose(a, b, t)),
    onTick,
    onDone: done,
  });
}

/** The job running custom tween `ct` from `from` to `to`, calling `onTick` with each value. */
export function customTweenJob<TData>(
  animator: Animator,
  timing: TweenTiming,
  cancelKey: string,
  ct: CustomTween<TData>,
  from: unknown,
  to: unknown,
  onTick: (value: unknown) => void,
): TweenJob {
  return (done) => animator.tween({
    from,
    to,
    ms: timing.duration,
    easing: timing.easing,
    cancelKey,
    interpolator: ct.interpolate,
    interpolate: ct.interpolate
      ? undefined
      : ((a, b, t) => {
          // Fallback per-tick interpolator for numeric values when no factory is given.
          if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
          throw new Error(
            `d3Bind.transition.tween("${ct.name}"): non-numeric value without an interpolate factory`,
          );
        }),
    onTick,
    onDone: done,
  });
}
