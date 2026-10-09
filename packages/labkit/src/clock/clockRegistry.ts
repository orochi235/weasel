import { createContext } from 'react';
import type { TrialClockHandle } from './trialClock';

/** A lab's clocks: each trial's, by trial id, and the lab's own. A trial has at
 *  most one, and trials playing on the lab's clock all hold that one. */
export interface ClockRegistry {
  /** Publish `handle` under `trialId` and return its release. */
  register(trialId: string, handle: TrialClockHandle): () => void;
  get(trialId: string): TrialClockHandle | null;
  /** The lab's own clock, when `<Lab clock>` declares one. */
  readonly lab: TrialClockHandle | null;
  /** Every clock once, however many trials hold it. */
  all(): Iterable<TrialClockHandle>;
  /** Fires after any register or release. Shaped for `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void;
}

/** An in-memory `ClockRegistry`, holding the lab's own clock when given one. */
export function createClockRegistry(lab: TrialClockHandle | null = null): ClockRegistry {
  const handles = new Map<string, TrialClockHandle>();
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const l of [...listeners]) l();
  };
  return {
    register(trialId, handle) {
      handles.set(trialId, handle);
      notify();
      return () => {
        if (handles.get(trialId) !== handle) return;
        handles.delete(trialId);
        notify();
      };
    },
    get: (trialId) => handles.get(trialId) ?? null,
    lab,
    all: () => new Set(lab ? [lab, ...handles.values()] : handles.values()),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The registry a lab keeps its clocks in. */
export const ClockRegistryContext = createContext<ClockRegistry | null>(null);

/** The clock of the trial a component renders inside, when it has one. */
export const TrialClockContext = createContext<TrialClockHandle | null>(null);
