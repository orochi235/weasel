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
  /** Stop the timer. The queue survives; `clear()` empties it. */
  stop(): void;
  /** Book `fire` for engine time `when`. It runs on the first pass whose
   *  lookahead window reaches it, receiving `when` so it can hand the true
   *  time to `source.start()` rather than "now". */
  schedule(when: number, fire: (when: number) => void, key?: string): void;
  /** Drop queued events with this key. A pass takes its whole batch out of the
   *  queue before firing any of it, so a callback cannot cancel a sibling that
   *  came due alongside it. */
  cancelKey(key: string): void;
  /** Drop every queued event. Without this, a stop/start cycle fires
   *  everything that came due meanwhile in one burst on the first pass. */
  clear(): void;
  pending(): number;
}

/**
 * Lookahead scheduler. Each pass fires everything due within `lookahead` ms,
 * in time order, handing each callback its own scheduled time.
 *
 * It runs on its own timer rather than on an animation frame, which stalls
 * audio in a backgrounded tab — see the README.
 */
export function createScheduler(opts: SchedulerOptions): Scheduler {
  const lookahead = opts.lookahead ?? 100;
  const interval = opts.interval ?? 25;
  let queue: Entry[] = [];
  let running = false;
  let handle: unknown = null;

  const pass = (): void => {
    const horizon = opts.now() + lookahead;
    const due: Entry[] = [];
    const rest: Entry[] = [];
    for (const entry of queue) (entry.when <= horizon ? due : rest).push(entry);
    queue = rest;
    due.sort((a, b) => a.when - b.when);
    for (const entry of due) {
      try {
        entry.fire(entry.when);
      } catch (err) {
        console.error('@weasel-js/audio scheduler: callback threw', err);
      }
    }
    if (running) handle = opts.setTimer(pass, interval);
  };

  return {
    start() {
      if (running) return;
      running = true;
      handle = opts.setTimer(pass, interval);
    },
    stop() {
      if (!running) return;
      running = false;
      opts.clearTimer(handle);
      handle = null;
    },
    schedule(when, fire, key) {
      queue.push({ when, fire, key });
    },
    cancelKey(key) {
      queue = queue.filter((e) => e.key !== key);
    },
    clear() {
      queue = [];
    },
    pending: () => queue.length,
  };
}
