import { createContext } from 'react';
import type { TrialClockHandle } from './trialClock';

/** A lab's trial clocks, by trial id. A trial has at most one. */
export interface ClockRegistry {
  /** Publish `handle` under `trialId` and return its release. */
  register(trialId: string, handle: TrialClockHandle): () => void;
  get(trialId: string): TrialClockHandle | null;
  all(): Iterable<TrialClockHandle>;
  /** Fires after any register or release. Shaped for `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void;
}

/** An empty in-memory `ClockRegistry`. */
export function createClockRegistry(): ClockRegistry {
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
    all: () => handles.values(),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The registry a lab keeps its trials' clocks in. */
export const ClockRegistryContext = createContext<ClockRegistry | null>(null);

/** The clock of the trial a component renders inside, when it declares one. */
export const TrialClockContext = createContext<TrialClockHandle | null>(null);
