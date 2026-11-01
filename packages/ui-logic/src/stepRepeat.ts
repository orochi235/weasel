import { timerScheduler, type Scheduler } from './scheduler';

/** How long a held stepper waits before it repeats, in milliseconds. */
export const REPEAT_DELAY_MS = 400;
/** How often a held stepper steps once it repeats, in milliseconds. */
export const REPEAT_EVERY_MS = 60;

/** The timing of a {@link createStepRepeat}. Each is read when it is next used, so a getter can change it mid-hold. */
export interface StepRepeatOptions {
  /** Default {@link REPEAT_DELAY_MS}. */
  delayMs?: number;
  /** Default {@link REPEAT_EVERY_MS}. */
  everyMs?: number;
  /** Default {@link timerScheduler}. */
  scheduler?: Pick<Scheduler, 'set'>;
}

/** A held stepper: {@link createStepRepeat}. */
export interface StepRepeat<K> {
  /** Step `key` once now, then after the delay once every interval until {@link stop}. Replaces any hold. */
  start(key: K): void;
  stop(): void;
  /** The key being held, or null. */
  held(): K | null;
}

/**
 * Hold-to-repeat stepping, whatever draws the stepper: `step` moves the value by `key`, and `spent` says `key`
 * has nowhere left to go, which ends the hold. Both are called at the moment of each step.
 */
export function createStepRepeat<K>(
  step: (key: K) => void, spent: (key: K) => boolean, opts: StepRepeatOptions = {},
): StepRepeat<K> {
  let cancel: (() => void) | null = null;
  let key: K | null = null;
  let hold = 0;
  const stop = () => {
    cancel?.();
    cancel = null;
    key = null;
    hold++;
  };
  const tick = (k: K, ms: number) => {
    cancel = (opts.scheduler ?? timerScheduler).set(() => {
      // A stepper at its bound may be disabled while still held, and never hear the release that ends the hold.
      if (spent(k)) return stop();
      step(k);
      tick(k, opts.everyMs ?? REPEAT_EVERY_MS);
    }, ms);
  };
  return {
    start(k) {
      stop();
      const mine = hold;
      key = k;
      step(k);
      // `step` may have ended or replaced this hold.
      if (hold === mine) tick(k, opts.delayMs ?? REPEAT_DELAY_MS);
    },
    stop,
    held: () => key,
  };
}
