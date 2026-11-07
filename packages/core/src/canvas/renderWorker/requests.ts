/** Requests the page sends a worker and the answers it waits on, matched by id. */
export interface Requests<T> {
  /** Send a request under a fresh id, and wait for its answer. */
  ask(send: (id: number) => void): Promise<T>;
  settle(id: number, value: T): void;
  /** Answer everything still waiting with `value`. */
  drain(value: T): void;
}

export function createRequests<T>(): Requests<T> {
  let next = 0;
  const waiting = new Map<number, (value: T) => void>();
  return {
    ask(send) {
      const id = ++next;
      return new Promise<T>((resolve) => {
        waiting.set(id, resolve);
        send(id);
      });
    },
    settle(id, value) {
      waiting.get(id)?.(value);
      waiting.delete(id);
    },
    drain(value) {
      for (const resolve of waiting.values()) resolve(value);
      waiting.clear();
    },
  };
}
