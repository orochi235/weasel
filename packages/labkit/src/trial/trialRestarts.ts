import type { LabStore } from '../state/store';

const heard = new WeakMap<LabStore, Map<string, Set<() => void>>>();

/** Hear each time trial `trialId` of `store` starts its undo afresh: a Reset,
 *  or a snapshot loaded over it. Returns the stop. */
export function onTrialRestart(store: LabStore, trialId: string, listener: () => void): () => void {
  let byTrial = heard.get(store);
  if (!byTrial) heard.set(store, (byTrial = new Map()));
  const listeners = byTrial.get(trialId) ?? new Set();
  byTrial.set(trialId, listeners);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) byTrial.delete(trialId);
  };
}

/** Tell trial `trialId`'s listeners that it starts its undo afresh. */
export function announceTrialRestart(store: LabStore, trialId: string): void {
  for (const listener of [...(heard.get(store)?.get(trialId) ?? [])]) listener();
}
