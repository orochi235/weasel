import type { History } from '@weasel-js/core';
import type { TrialHistorySource } from './trialHistory';

/** A weasel `History` as the source `useTrialHistory` hands over: a page's own history, kept outside any scene. */
export function trialHistoryOf(history: History): TrialHistorySource {
  return {
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    undo: () => history.undo(),
    redo: () => history.redo(),
    undoStamp: () => history.entries().undo.at(-1)?.timestamp,
    redoStamp: () => history.entries().redo[0]?.timestamp,
    dropRedo: () => history.dropRedo(),
    clear: () => history.clear(),
    subscribe: (listener) => history.subscribe(listener),
    record: (op, label) => history.recordEntry([op], label),
  };
}
