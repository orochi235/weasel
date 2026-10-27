import { createEmitter } from '@weasel-js/registry';
import type { ClockHandle } from './types';

/** A host's clocks: each run's, by id, and one shared among them. An id has at
 *  most one, and runs playing on the shared clock all hold that one. */
export interface ClockRegistry {
  /** Publish `handle` under `id` and return its release. */
  register(id: string, handle: ClockHandle): () => void;
  get(id: string): ClockHandle | null;
  /** The clock shared among the runs, when the host declares one. */
  readonly shared: ClockHandle | null;
  /** Every clock once, however many ids hold it. */
  all(): Iterable<ClockHandle>;
  /** Fires after any register or release. Shaped for `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void;
}

/** An in-memory `ClockRegistry`, holding the shared clock when given one. */
export function createClockRegistry(shared: ClockHandle | null = null): ClockRegistry {
  const handles = new Map<string, ClockHandle>();
  const changed = createEmitter();
  const notify = changed.emit;
  return {
    register(id, handle) {
      handles.set(id, handle);
      notify();
      return () => {
        if (handles.get(id) !== handle) return;
        handles.delete(id);
        notify();
      };
    },
    get: (id) => handles.get(id) ?? null,
    shared,
    all: () => new Set(shared ? [shared, ...handles.values()] : handles.values()),
    subscribe: changed.subscribe,
  };
}
