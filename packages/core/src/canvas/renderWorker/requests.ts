/** Requests the page sends a worker and the answers it waits on, matched by id. */
export interface Requests<T> {
  /** Send a request under a fresh id, and wait for its answer: `missing` when none comes within
   *  the timeout or the requests are drained first. `settled` hears the answer as it lands, in
   *  the same task. A `send` that throws leaves nothing waiting and rethrows. */
  ask(send: (id: number) => void, settled?: (value: T) => void): Promise<T>;
  /** Answer request `id`. An id no longer waiting is ignored: its answer came too late. */
  settle(id: number, value: T): void;
  /** Answer everything still waiting as missing. */
  drain(): void;
  /** How many requests wait. */
  readonly size: number;
}

export interface RequestBounds<T> {
  /** The answer a request gets when the worker gives none. */
  missing: () => T;
  /** Milliseconds a request waits; `Infinity` waits until drained. */
  timeout: number;
  /** A request timed out. */
  onTimeout?: () => void;
}

export function createRequests<T>(bounds: RequestBounds<T>): Requests<T> {
  let next = 0;
  const waiting = new Map<number, { answer: (value: T) => void; timer: ReturnType<typeof setTimeout> | undefined }>();
  const finish = (id: number, value: T) => {
    const entry = waiting.get(id);
    if (!entry) return;
    waiting.delete(id);
    clearTimeout(entry.timer);
    entry.answer(value);
  };
  return {
    ask(send, settled) {
      const id = ++next;
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => { resolve = r; });
      const timer = Number.isFinite(bounds.timeout)
        ? setTimeout(() => { finish(id, bounds.missing()); bounds.onTimeout?.(); }, bounds.timeout)
        : undefined;
      waiting.set(id, { answer: (value) => { settled?.(value); resolve(value); }, timer });
      try {
        send(id);
      } catch (e) {
        waiting.delete(id);
        clearTimeout(timer);
        throw e;
      }
      return promise;
    },
    settle: finish,
    drain() {
      for (const id of [...waiting.keys()]) finish(id, bounds.missing());
    },
    get size() { return waiting.size; },
  };
}
