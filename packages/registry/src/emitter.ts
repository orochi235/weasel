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

/** An {@link Emitter} per key, held only while it has listeners. See {@link createKeyedEmitter}. */
export interface KeyedEmitter<K, TArgs extends unknown[] = []> {
  /** Add `listener` under `key`. Returns the unsubscribe, which forgets the key's emitter once it holds no one. */
  subscribe(key: K, listener: (...args: TArgs) => void): () => void;
  /** Call every listener `key` held when the call began, as {@link Emitter.emit} does. */
  emit(key: K, ...args: TArgs): void;
  /** Forget every listener under `key`. An unsubscribe from before it touches no later subscription. */
  clear(key: K): void;
  /** How many listeners `key` holds. */
  size(key: K): number;
}

/**
 * {@link createEmitter}'s semantics for listeners filed by key: a pass over one key's listeners is
 * a snapshot, a throw is logged rather than stopping the rest, and an unsubscribe — called twice,
 * or after `clear` — removes only its own subscription, never the emitter a later one made.
 */
export function createKeyedEmitter<K, TArgs extends unknown[] = []>(): KeyedEmitter<K, TArgs> {
  const byKey = new Map<K, Emitter<TArgs>>();
  return {
    subscribe(key, listener) {
      let emitter = byKey.get(key);
      if (!emitter) {
        emitter = createEmitter<TArgs>();
        byKey.set(key, emitter);
      }
      const mine = emitter;
      const off = mine.subscribe(listener);
      return () => {
        off();
        if (mine.size === 0 && byKey.get(key) === mine) byKey.delete(key);
      };
    },
    emit(key, ...args) {
      byKey.get(key)?.emit(...args);
    },
    clear(key) {
      byKey.delete(key);
    },
    size(key) {
      return byKey.get(key)?.size ?? 0;
    },
  };
}
