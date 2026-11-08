import type { Clock, ClockHandle } from '@weasel-js/clock';

/** Whether `handle`'s clock reaches a time by running there rather than seeking: not seekable, with a `step`. */
export const runs = (handle: ClockHandle): handle is ClockHandle & { step: number } =>
  !handle.clock.seekable && handle.step !== undefined && handle.step > 0;

/** Play `clock` forward to `at`, `step` ms a frame, as frames nothing showed. */
export function runTo(clock: Clock, at: number, step: number): void {
  let now = 0;
  clock.rebase();
  clock.rate = 1;
  clock.sync(now);
  // The count bounds a sum of steps that rounding leaves a hair short of `at`.
  for (let left = Math.ceil((at - clock.elapsed) / step) + 1; left > 0; left--) {
    if (clock.rate === 0 || clock.elapsed >= at) break;
    now += Math.min(step, at - clock.elapsed);
    clock.sync(now);
  }
  clock.rate = 0;
  clock.rebase();
}
