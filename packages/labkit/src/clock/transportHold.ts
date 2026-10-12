import type { TrialClock } from './trialClock';

/** What a clock's transports keep between them: the speed and direction a
 *  pause comes back to, and whether anyone has worked the clock by hand. */
export interface TransportHold {
  /** Unsigned. */
  readonly speed: number;
  readonly backward: boolean;
  readonly touched: boolean;
}

/** One clock's {@link TransportHold}. Shaped for `useSyncExternalStore`. */
export interface TransportHoldStore {
  get(): TransportHold;
  set(next: { speed: number; backward: boolean }): void;
  touch(): void;
  subscribe(listener: () => void): () => void;
}

const stores = new WeakMap<TrialClock, TransportHoldStore>();

/** The hold every transport over `clock` shares, opened on the rate the clock
 *  runs at, or at `1` forward for one that is paused. */
export function transportHoldOf(clock: TrialClock): TransportHoldStore {
  const kept = stores.get(clock);
  if (kept) return kept;
  let hold: TransportHold = {
    speed: Math.abs(clock.rate) || 1,
    backward: clock.rate < 0,
    touched: false,
  };
  const listeners = new Set<() => void>();
  const replace = (next: TransportHold): void => {
    hold = next;
    for (const listener of [...listeners]) listener();
  };
  const store: TransportHoldStore = {
    get: () => hold,
    set: ({ speed, backward }) => {
      if (speed !== hold.speed || backward !== hold.backward) replace({ ...hold, speed, backward });
    },
    touch: () => {
      if (!hold.touched) replace({ ...hold, touched: true });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  stores.set(clock, store);
  return store;
}
