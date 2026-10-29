/** A set of listeners and the one way the kit notifies them. See {@link createEmitter}. */
export interface Emitter<TArgs extends unknown[] = []> {
  /** Add `listener`; a listener already held is held once. Returns the unsubscribe. */
  subscribe(listener: (...args: TArgs) => void): () => void;
  /** Call every listener held when the call began. */
  emit(...args: TArgs): void;
  /** How many listeners are held. */
  readonly size: number;
}

/**
 * A subscribe/notify pair with stated semantics, for a store to build on
 * instead of keeping its own listener set:
 *
 * - `emit` walks the listeners held when it began, in subscription order. One
 *   that subscribes during a pass waits for the next; one unsubscribed before
 *   its turn is not called.
 * - A listener that throws does not stop the others, and does not throw into
 *   whatever caused the notify: the error goes to `console.error`.
 */
export function createEmitter<TArgs extends unknown[] = []>(): Emitter<TArgs> {
  const listeners = new Set<(...args: TArgs) => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    emit(...args) {
      if (listeners.size === 0) return;
      for (const listener of [...listeners]) {
        if (!listeners.has(listener)) continue;
        try {
          listener(...args);
        } catch (err) {
          console.error('weasel: a subscriber threw', err);
        }
      }
    },
    get size() {
      return listeners.size;
    },
  };
}
