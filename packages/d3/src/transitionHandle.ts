import type { NodeId } from '@weasel-js/core';
import type { EasingFn } from '@weasel-js/animator';
import type { CustomTween } from './transitionTweens';
import type { D3Transition } from './types';

/** What a transition's builder calls set: read by its items as they run. */
export interface StageSettings<TData, TPose> {
  duration: number;
  easing: EasingFn | undefined;
  delay: ((d: TData, i: number) => number) | null;
  pose: ((d: TData, i: number) => TPose) | null;
  tweens: Array<CustomTween<TData>>;
  /** Whether `.remove()` was called. */
  remove: boolean;
}

/** What a transition's handle does beyond recording settings. */
export interface StageControls<TData, TPose> {
  on(event: 'start' | 'end' | 'interrupt', fn: () => void): void;
  /** Chain a transition after this one. */
  chain(): D3Transition<TData, TPose>;
  interrupt(): void;
  /** Called after `settings.remove` is set. */
  remove(): void;
  end(): Promise<void>;
}

/** The public handle of a transition, writing its builder calls into `settings`. */
export function createTransitionHandle<TData, TPose>(
  settings: StageSettings<TData, TPose>,
  controls: StageControls<TData, TPose>,
): D3Transition<TData, TPose> {
  const t: D3Transition<TData, TPose> = {
    duration(ms) {
      if (Number.isNaN(ms)) throw new RangeError('d3Bind.transition.duration: ms is a time, not NaN');
      settings.duration = ms;
      return t;
    },
    ease(fn) {
      settings.easing = fn;
      return t;
    },
    delay(arg) {
      settings.delay = typeof arg === 'function' ? arg : () => arg;
      return t;
    },
    pose(fn) {
      settings.pose = fn;
      return t;
    },
    tween(opts) {
      settings.tweens.push({
        name: opts.name,
        from: opts.from as (d: TData, i: number) => unknown,
        to: opts.to as (d: TData, i: number) => unknown,
        interpolate: opts.interpolate as
          | ((from: unknown, to: unknown) => (t: number) => unknown)
          | undefined,
        apply: opts.apply as (d: TData, id: NodeId, value: unknown) => void,
      });
      return t;
    },
    on(event, fn) {
      controls.on(event, fn);
      return t;
    },
    transition: () => controls.chain(),
    interrupt() {
      controls.interrupt();
    },
    remove() {
      settings.remove = true;
      controls.remove();
      return t;
    },
    end: () => controls.end(),
  };
  return t;
}
