import { createReflectable, type Reflection } from '@weasel-js/registry';
import type { ClockHandle } from './types';

/** Resolves the view showing a clock: an `Element` where there is a DOM, and
 *  opaque to the registry, so its root entry needs no DOM. */
export type ClockTarget = () => object | null;

/** A host's clocks: each run's, by id, and one shared among them. An id shows its
 *  newest registration, and releasing that one brings back the one it displaced,
 *  as every kit registry does. Runs playing on the shared clock all hold that one. */
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
  /** Each id's clock and the target it named. A second registration under an id replaces the first
   *  rather than shadowing it. */
  readonly reflection: Reflection<ClockEntry>;
}

/** One id's registration, as {@link ClockRegistry.reflection} lists it. */
export interface ClockEntry {
  readonly handle: ClockHandle;
  readonly target: ClockTarget | undefined;
}

/** An in-memory `ClockRegistry`, holding the shared clock when given one. */
export function createClockRegistry(shared: ClockHandle | null = null): ClockRegistry {
  const entries = createReflectable<ClockEntry>();
  return {
    register: (id, handle, target) => entries.push(id, { handle, target }),
    get: (id) => entries.get(id)?.handle ?? null,
    targets(handle) {
      const found: ClockTarget[] = [];
      for (const { value } of entries.entries()) {
        if (value.handle !== handle) continue;
        if (!value.target) return [];
        found.push(value.target);
      }
      return found;
    },
    shared,
    all: () => new Set([...(shared ? [shared] : []), ...entries.entries().map((e) => e.value.handle)]),
    subscribe: entries.subscribe,
    reflection: entries.reflection,
  };
}
