import { createEmitter } from './emitter';

/** One value, readable and watchable, shaped for `useSyncExternalStore`. See {@link createValueStore}. */
export interface ValueStore<T> {
  get(): T;
  /** Hold `next` and notify, unless `equal` reads it as the value already held. */
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}

/**
 * A store of one value that notifies only when a write changes it. `equal`
 * decides what a change is, `Object.is` by default (so a repeated `NaN` is no
 * change); pass `sameList` or `deepEqual` for a value rebuilt on every write.
 * A write `equal` reads as no change keeps the value already held.
 */
export function createValueStore<T>(initial: T, equal: (a: T, b: T) => boolean = Object.is): ValueStore<T> {
  let value = initial;
  const changed = createEmitter();
  return {
    get: () => value,
    set(next) {
      if (equal(value, next)) return;
      value = next;
      changed.emit();
    },
    subscribe: changed.subscribe,
  };
}
