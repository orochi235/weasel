/** Clock and timer, injected so tests and hosts control time. */
export interface Scheduler {
  now(): number;
  /** Run `fn` after `ms`; returns a cancel. */
  set(fn: () => void, ms: number): () => void;
}

/** The real-time scheduler: `Date.now` and `setTimeout`. */
export const timerScheduler: Scheduler = {
  now: () => Date.now(),
  set: (fn, ms) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};
