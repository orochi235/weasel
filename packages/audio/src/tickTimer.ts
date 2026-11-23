import { after, LONGEST_TIMER_MS } from '@weasel-js/registry';

/** Runs in the worker. A message with `ms` books timer `id`; one without clears
 *  it. Each timer posts its id back once, when it elapses, as `after` waits. */
const WORKER_SOURCE = `const timers = new Map();
const LONGEST = ${LONGEST_TIMER_MS};
self.onmessage = (e) => {
  const id = e.data.id;
  clearTimeout(timers.get(id));
  timers.delete(id);
  if (e.data.ms === undefined || e.data.ms === Infinity) return;
  const wait = (left) => {
    timers.set(id, setTimeout(() => {
      if (left > LONGEST) return wait(left - LONGEST);
      timers.delete(id);
      self.postMessage(id);
    }, Math.min(left, LONGEST)));
  };
  wait(e.data.ms);
};
`;

/** The timer pair `createTickTimer` returns, shaped for `SchedulerOptions`. */
export interface TickTimer {
  /** One-shot, as `createScheduler` expects. */
  setTimer(cb: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** Terminate the worker and drop every pending timer. */
  dispose(): void;
}

interface Pending {
  cb: () => void;
  ms: number;
  fallback?: () => void;
}

function spawn(): { worker: Worker; url: string } | null {
  if (
    typeof Worker !== 'function' ||
    typeof Blob !== 'function' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return null;
  }
  let url: string | undefined;
  try {
    url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    return { worker: new Worker(url), url };
  } catch {
    if (url !== undefined) URL.revokeObjectURL(url);
    return null;
  }
}

/**
 * A timer for the scheduler's pass that is not held to the main thread's
 * hidden-tab clamp: each delay runs inside a dedicated Worker, which posts back
 * when it elapses. Falls back to `setTimeout` when no worker can be made — no
 * `Worker` global, a constructor that throws, or a worker that fails to load,
 * which is how a CSP refusal can arrive.
 */
export function createTickTimer(): TickTimer {
  let nextId = 1;
  const pending = new Map<number, Pending>();
  let spawned = spawn();

  const fire = (id: number): void => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    p.cb();
  };
  const arm = (id: number, p: Pending): void => {
    p.fallback = after(p.ms, () => fire(id));
  };
  const release = (): void => {
    if (!spawned) return;
    spawned.worker.terminate();
    URL.revokeObjectURL(spawned.url);
    spawned = null;
  };

  if (spawned) {
    spawned.worker.addEventListener('message', (e: MessageEvent) => fire(e.data as number));
    spawned.worker.addEventListener('error', () => {
      if (!spawned) return;
      release();
      // Anything posted to a worker that never loaded is lost with it.
      for (const [id, p] of pending) arm(id, p);
    });
  }

  return {
    setTimer(cb, ms) {
      const id = nextId++;
      const p: Pending = { cb, ms };
      pending.set(id, p);
      if (spawned) spawned.worker.postMessage({ id, ms });
      else arm(id, p);
      return id;
    },
    clearTimer(handle) {
      const id = handle as number;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (p.fallback !== undefined) p.fallback();
      else spawned?.worker.postMessage({ id });
    },
    dispose() {
      for (const p of pending.values()) p.fallback?.();
      pending.clear();
      release();
    },
  };
}
