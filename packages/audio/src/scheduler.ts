export interface SchedulerOptions {
  /** Engine time in ms. Backed by `AudioContext.currentTime * 1000` in production. */
  now: () => number;
  setTimer: (cb: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  /** How far ahead to book events, in ms. Default 100. */
  lookahead?: number;
  /** Time between passes, in ms. Default 25. */
  interval?: number;
}

interface Entry {
  when: number;
  fire: (when: number) => void;
  key?: string;
}

export interface Scheduler {
  start(): void;
  stop(): void;
  /** Book `fire` for engine time `when`. It runs on the first pass whose
   *  lookahead window reaches it, receiving `when` so it can hand the true
   *  time to `source.start()` rather than "now". */
  schedule(when: number, fire: (when: number) => void, key?: string): void;
  cancelKey(key: string): void;
  pending(): number;
}

/**
 * Lookahead scheduler. Each pass fires everything due within `lookahead` ms,
 * in time order, handing each callback its own scheduled time.
 *
 * It runs on its own timer rather than on an animation frame: rAF throttles to
 * roughly 1 Hz in a backgrounded tab and stops when nothing is animating, both
 * of which stall audio exactly when nothing is on screen.
 */
export function createScheduler(opts: SchedulerOptions): Scheduler {
  const lookahead = opts.lookahead ?? 100;
  const interval = opts.interval ?? 25;
  let queue: Entry[] = [];
  let handle: unknown = null;

  const pass = (): void => {
    const horizon = opts.now() + lookahead;
    const due = queue.filter((e) => e.when <= horizon).sort((a, b) => a.when - b.when);
    if (due.length > 0) {
      const dueSet = new Set(due);
      queue = queue.filter((e) => !dueSet.has(e));
    }
    for (const entry of due) {
      try {
        entry.fire(entry.when);
      } catch (err) {
        console.error('@weasel-js/audio scheduler: callback threw', err);
      }
    }
    if (handle !== null) handle = opts.setTimer(pass, interval);
  };

  return {
    start() {
      if (handle !== null) return;
      // Non-null before the first setTimer so `pass` knows it is running.
      handle = true;
      handle = opts.setTimer(pass, interval);
    },
    stop() {
      if (handle === null) return;
      opts.clearTimer(handle);
      handle = null;
    },
    schedule(when, fire, key) {
      queue.push({ when, fire, key });
    },
    cancelKey(key) {
      queue = queue.filter((e) => e.key !== key);
    },
    pending: () => queue.length,
  };
}
