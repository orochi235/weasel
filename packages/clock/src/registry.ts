import { createEmitter } from '@weasel-js/registry';
import type { ClockHandle } from './types';

/** Resolves the view showing a clock: an `Element` where there is a DOM, and
 *  opaque to the registry, so its root entry needs no DOM. */
export type ClockTarget = () => object | null;

/** A host's clocks: each run's, by id, and one shared among them. An id has at
 *  most one, and runs playing on the shared clock all hold that one. */
export interface ClockRegistry {
  /** Publish `handle` under `id` and return its release. `target` names the
   *  element showing it, resolved when read, so a ref filled later works. */
  register(id: string, handle: ClockHandle, target?: ClockTarget): () => void;
  get(id: string): ClockHandle | null;
  /** The clock shared among the runs, when the host declares one. */
  readonly shared: ClockHandle | null;
  /** The elements showing `handle`, one per registration. Empty when any
   *  registration named none, since that one may be seen anywhere. */
  targets(handle: ClockHandle): readonly ClockTarget[];
  /** Every clock once, however many ids hold it. */
  all(): Iterable<ClockHandle>;
  /** Fires after any register or release. Shaped for `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void;
}

/** An in-memory `ClockRegistry`, holding the shared clock when given one. */
export function createClockRegistry(shared: ClockHandle | null = null): ClockRegistry {
  interface Entry {
    handle: ClockHandle;
    target: ClockTarget | undefined;
  }
  const entries = new Map<string, Entry>();
  const changed = createEmitter();
  const notify = changed.emit;
  return {
    register(id, handle, target) {
      const entry: Entry = { handle, target };
      entries.set(id, entry);
      notify();
      return () => {
        if (entries.get(id) !== entry) return;
        entries.delete(id);
        notify();
      };
    },
    get: (id) => entries.get(id)?.handle ?? null,
    targets(handle) {
      const found: ClockTarget[] = [];
      for (const entry of entries.values()) {
        if (entry.handle !== handle) continue;
        if (!entry.target) return [];
        found.push(entry.target);
      }
      return found;
    },
    shared,
    all: () => new Set([...(shared ? [shared] : []), ...[...entries.values()].map((e) => e.handle)]),
    subscribe: changed.subscribe,
  };
}
