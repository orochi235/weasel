const heard = new WeakMap<object, Map<string, Set<() => void>>>();

/** Hear each time trial `trialId` of the lab store `store` starts its undo afresh: a Reset,
 *  or a snapshot loaded over it. Returns the stop. */
export function onTrialRestart(store: object, trialId: string, listener: () => void): () => void {
  const byTrial = heard.get(store) ?? new Map<string, Set<() => void>>();
  heard.set(store, byTrial);
  const listeners = byTrial.get(trialId) ?? new Set();
  byTrial.set(trialId, listeners);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) byTrial.delete(trialId);
  };
}

/** Tell trial `trialId`'s listeners that it starts its undo afresh. */
export function announceTrialRestart(store: object, trialId: string): void {
  for (const listener of [...(heard.get(store)?.get(trialId) ?? [])]) listener();
}
