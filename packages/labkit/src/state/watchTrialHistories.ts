import type { History } from '@weasel-js/core';
import { onOwnUndoStep } from './ownUndo';
import type { LabStore } from './store';
import type { TrialRecord } from './types';

/**
 * Calls `onStep` with a trial's id each time the undo history `store` holds
 * for it takes a step. A step can change the history and nothing else in the
 * record, and the store does not hear those. A restore is not a step: what it
 * restored is already saved, and writing it back would echo another tab's
 * write to it. Returns the stop.
 */
export function watchTrialHistories(
  store: LabStore,
  onStep: (trialId: string) => void,
): () => void {
  const watched = new Map<string, { history: History; off: () => void }>();
  const sync = (trials: readonly TrialRecord[]): void => {
    const live = new Set<string>();
    for (const { id, history } of trials) {
      if (!history) continue;
      live.add(id);
      const known = watched.get(id);
      if (known?.history === history) continue;
      known?.off();
      const off = history.observe((step) => {
        if (step.kind !== 'restore') onStep(id);
      });
      watched.set(id, { history, off });
    }
    for (const [id, { off }] of watched) {
      if (live.has(id)) continue;
      off();
      watched.delete(id);
    }
  };
  sync(store.getState().trials);
  const offStore = store.subscribe((state, prev) => {
    if (state.trials !== prev.trials) sync(state.trials);
  });
  return () => {
    offStore();
    for (const { off } of watched.values()) off();
    watched.clear();
  };
}

/** Calls `onStep` with a trial's record each time one of its undo histories steps: its own, or
 *  the one its instrument handed over. Returns the stop. */
export function onUndoSteps(store: LabStore, onStep: (trial: TrialRecord) => void): () => void {
  const stepped = (id: string): void => {
    const trial = store.getState().trials.find((t) => t.id === id);
    if (trial) onStep(trial);
  };
  const offHistories = watchTrialHistories(store, stepped);
  const offOwn = onOwnUndoStep(store, stepped);
  return () => {
    offHistories();
    offOwn();
  };
}
