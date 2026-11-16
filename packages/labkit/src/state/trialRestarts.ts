import { createKeyedEmitter, type KeyedEmitter } from '@weasel-js/registry';

const heard = new WeakMap<object, KeyedEmitter<string>>();

/** Hear each time trial `trialId` of the lab store `store` starts its undo afresh: a Reset,
 *  or a snapshot loaded over it. Returns the stop. */
export function onTrialRestart(store: object, trialId: string, listener: () => void): () => void {
  let byTrial = heard.get(store);
  if (!byTrial) {
    byTrial = createKeyedEmitter();
    heard.set(store, byTrial);
  }
  return byTrial.subscribe(trialId, listener);
}

/** Tell trial `trialId`'s listeners that it starts its undo afresh. */
export function announceTrialRestart(store: object, trialId: string): void {
  heard.get(store)?.emit(trialId);
}
