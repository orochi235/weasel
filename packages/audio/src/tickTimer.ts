/** Runs in the worker. A message with `ms` books timer `id`; one without clears
 *  it. Each timer posts its id back once, when it elapses. */
const WORKER_SOURCE = `const timers = new Map();
self.onmessage = (e) => {
  const id = e.data.id;
  clearTimeout(timers.get(id));
  timers.delete(id);
  if (e.data.ms === undefined) return;
  timers.set(id, setTimeout(() => {
    timers.delete(id);
    self.postMessage(id);
  }, e.data.ms));
};
`;

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
  fallback?: ReturnType<typeof setTimeout>;
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
    p.fallback = setTimeout(() => fire(id), p.ms);
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
      if (p.fallback !== undefined) clearTimeout(p.fallback);
      else spawned?.worker.postMessage({ id });
    },
    dispose() {
      for (const p of pending.values()) {
        if (p.fallback !== undefined) clearTimeout(p.fallback);
      }
      pending.clear();
      release();
    },
  };
}
