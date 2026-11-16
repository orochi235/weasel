import { after } from '@weasel-js/registry';

/** Clock and timer, injected so tests and hosts control time. */
export interface Scheduler {
  now(): number;
  /** Run `fn` after `ms`; returns a cancel. */
  set(fn: () => void, ms: number): () => void;
}

/** The real-time scheduler: `Date.now` and registry's `after`, which waits out an `ms` longer than one timer holds. */
export const timerScheduler: Scheduler = {
  now: () => Date.now(),
  set: (fn, ms) => after(ms, fn),
};
