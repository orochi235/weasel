import { createEmitter, createPart } from '@weasel-js/registry';
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

/** The hold every transport over `clock` shares, opened on the rate the clock
 *  runs at, or at its `speed` forward for one that is paused. */
export const transportHoldOf = createPart((clock: TrialClock): TransportHoldStore => {
  let hold: TransportHold = {
    speed: Math.abs(clock.rate) || clock.speed,
    backward: clock.rate < 0,
    touched: false,
  };
  const changed = createEmitter();
  const replace = (next: TransportHold): void => {
    hold = next;
    changed.emit();
  };
  const store: TransportHoldStore = {
    get: () => hold,
    set: ({ speed, backward }) => {
      if (!Object.is(speed, hold.speed) || backward !== hold.backward)
        replace({ ...hold, speed, backward });
    },
    touch: () => {
      if (!hold.touched) replace({ ...hold, touched: true });
    },
    subscribe: changed.subscribe,
  };
  return store;
});
