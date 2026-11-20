import type { History, SerializedHistory } from '@weasel-js/core';
import { restoreStamps, stampEdits, stampOf } from '../undo/historyStamps';
import type { TrialHistorySource } from './trialHistory';

/** What `trialHistoryOf` saves: the history, and the stamps kept for its entries. */
interface SavedTrialHistory {
  history: SerializedHistory;
  stamps: [number, number][];
}

/** A weasel `History` as the source `useTrialHistory` hands over: a page's own history, kept outside any
 *  scene. It saves and restores the history, the entries the trial recorded on it included, and stamps each
 *  entry while the trial is subscribed so its steps order against the trial's marks. */
export function trialHistoryOf(history: History): TrialHistorySource {
  const stamps = new Map<number, number>();
  let subscribers = 0;
  let stopStamping: (() => void) | null = null;
  return {
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    undo: () => history.undo(),
    redo: () => history.redo(),
    undoStamp: () => stampOf(history, stamps, 'undo'),
    redoStamp: () => stampOf(history, stamps, 'redo'),
    dropRedo: () => history.dropRedo(),
    clear: () => history.clear(),
    subscribe: (listener) => {
      const off = history.subscribe(listener);
      if (subscribers++ === 0) stopStamping = stampEdits(history, stamps);
      return () => {
        off();
        if (--subscribers === 0) {
          stopStamping?.();
          stopStamping = null;
        }
      };
    },
    record: (op, label) => history.recordEntry([op], label),
    serialize: (): SavedTrialHistory => ({ history: history.serialize(), stamps: [...stamps] }),
    restore: (data, rebuild) => {
      const saved = data as Partial<SavedTrialHistory> | null;
      if (!saved?.history) return;
      history.restore(saved.history, { rebuildOp: (name, args) => rebuild(name, args) });
      restoreStamps(stamps, saved.stamps, saved.history);
    },
  };
}
