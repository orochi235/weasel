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
  type Listener = (...args: TArgs) => void;
  /** Each listener held, by the subscription holding it: a token that a pass and an unsubscribe check against. */
  const listeners = new Map<Listener, object>();
  /** `listeners` as an array, rebuilt only after it changes: an emit walks this one. */
  let held: (readonly [Listener, object])[] | null = null;
  return {
    subscribe(listener) {
      let token = listeners.get(listener);
      if (token === undefined) {
        token = {};
        listeners.set(listener, token);
        held = null;
      }
      const mine = token;
      return () => {
        if (listeners.get(listener) !== mine) return;
        listeners.delete(listener);
        held = null;
      };
    },
    emit(...args) {
      if (listeners.size === 0) return;
      for (const [listener, token] of (held ??= [...listeners])) {
        if (listeners.get(listener) !== token) continue;
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
