import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Clock } from './clock';

/** Each trial's story clock, by trial id: the story's trial publishes it, and the trial's transport reads it. */
export interface TrialClocks {
  /** Publishes `clock` as `trialId`'s; the returned function withdraws it. */
  publish(trialId: string, clock: Clock): () => void;
  get(trialId: string): Clock | null;
  subscribe(listener: () => void): () => void;
}

export function createTrialClocks(): TrialClocks {
  const clocks = new Map<string, Clock>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  return {
    publish(trialId, clock) {
      clocks.set(trialId, clock);
      notify();
      return () => {
        if (clocks.get(trialId) !== clock) return;
        clocks.delete(trialId);
        notify();
      };
    },
    get: (trialId) => clocks.get(trialId) ?? null,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const TrialClocksContext = createContext<TrialClocks | null>(null);

const NEVER = () => () => {};
const NONE = () => null;

/** The clock trial `trialId`'s story published, or null. */
export function useTrialClock(trialId: string): Clock | null {
  const clocks = useContext(TrialClocksContext);
  return useSyncExternalStore(clocks?.subscribe ?? NEVER, clocks ? () => clocks.get(trialId) : NONE);
}
