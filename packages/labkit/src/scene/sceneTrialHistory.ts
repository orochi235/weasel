import type { Scene } from '@weasel-js/core';
import type { TrialHistorySource } from '../trial/trialHistory';

/** A scene's history as a trial steps it, taking the trial's settings entries
 *  onto the scene's own stack so one undo order covers both. */
export function sceneTrialHistory<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): TrialHistorySource {
  return {
    canUndo: () => scene.canUndo(),
    canRedo: () => scene.canRedo(),
    undo: () => scene.undo(),
    redo: () => scene.redo(),
    undoStamp: () => scene.history.timestampAt(scene.history.undoDepth() - 1),
    redoStamp: () => scene.history.timestampAt(scene.history.undoDepth()),
    subscribe: (listener) => scene.subscribe(listener),
    record: (op, label) => scene.history.recordEntry([op], label),
  };
}
