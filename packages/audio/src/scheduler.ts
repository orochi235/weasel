export interface SchedulerOptions {
  /** Engine time in ms. Backed by `AudioContext.currentTime * 1000` in production. */
  now: () => number;
  /** One-shot: it fires once and the pass re-arms it. `setInterval` here would
   *  leave every previous timer running. */
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
  /** Book `fire` for engine time `when`, receiving `when` so it can hand the
   *  true time to `source.start()` rather than "now". It runs on the first
   *  pass whose lookahead window reaches it — or, when the window already
   *  covers it and the scheduler is running, at the end of the current task,
   *  in time order with everything else then due. */
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
 * in time order, handing each callback its own scheduled time. An event
 * scheduled inside that window does not wait up to `interval` for the next
 * pass: the end of the current task fires what is due then.
 *
 * It runs on its own timer rather than on an animation frame, which stops
 * entirely when nothing is animating. The timer is one-shot: the pass re-arms
 * it at the end, so passes cannot overlap. A main-thread `setTimeout` is clamped
 * to a second in a hidden tab, which the lookahead cannot cover; the engine
 * passes `createTickTimer` instead.
 */
export function createScheduler(opts: SchedulerOptions): Scheduler {
  const lookahead = opts.lookahead ?? 100;
  const interval = opts.interval ?? 25;
  let queue: Entry[] = [];
  let running = false;
  let handle: unknown = null;

  let flushQueued = false;

  const fireDue = (): void => {
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
  };

  const pass = (): void => {
    fireDue();
    if (running) handle = opts.setTimer(pass, interval);
  };

  // A microtask rather than firing inside `schedule()`: everything booked in
  // one task is fired as one batch, sorted by time, exactly as a pass would.
  const flush = (): void => {
    flushQueued = false;
    if (running) fireDue();
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
      if (running && !flushQueued && when <= opts.now() + lookahead) {
        flushQueued = true;
        queueMicrotask(flush);
      }
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
