import type { Scene, SerializedSceneHistory } from '@weasel-js/core';
import { createPart } from '@weasel-js/registry';
import { TRIAL_EDIT_OP } from '../trial/trialEditOp';
import type { TrialHistorySource } from '../trial/trialHistory';
import { restoreStamps, stampEdits, stampOf } from '../undo/historyStamps';

type AnyScene = Pick<Scene<unknown, string, unknown>, 'history'>;

/** The `editStamp`s kept for `scene`'s entries, one map per scene. */
export const editStampsOf = createPart((_scene: object) => new Map<number, number>());

/** Stamps each entry `scene` records or merges into, as `stampEdits` does. Returns the stop. */
export function stampSceneEdits(scene: AnyScene, stamps: Map<number, number>): () => void {
  return stampEdits(scene.history, stamps);
}

/** What `sceneTrialHistory` saves: the scene's history, and the stamps kept for its entries. */
interface SavedSceneHistory {
  history: SerializedSceneHistory;
  stamps: [number, number][];
}

/** A scene's history as a trial steps it, taking the trial's settings entries
 *  onto the scene's own stack so one undo order covers both. A `batch` is a
 *  scene batch, so a settings entry and the scene edits made with it are one
 *  entry. Each step is
 *  stamped from `stamps` (`stampSceneEdits`), else from the scene's own
 *  timestamp. It saves and restores the scene's history with its stamps; the
 *  trial saves the scene itself, in its state. */
export function sceneTrialHistory<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  stamps: Map<number, number> = new Map(),
): TrialHistorySource {
  // Inside a batch, a settings entry is applied as part of it, which joins it to the batch's entry.
  let batching = 0;
  return {
    canUndo: () => scene.canUndo(),
    canRedo: () => scene.canRedo(),
    undo: () => scene.undo(),
    redo: () => scene.redo(),
    undoStamp: () => stampOf(scene.history, stamps, 'undo'),
    redoStamp: () => stampOf(scene.history, stamps, 'redo'),
    dropRedo: () => scene.history.dropRedo(),
    subscribe: (listener) => scene.subscribe(listener),
    record: (op, label) => {
      if (batching > 0) scene.applyBatch([op], label, null);
      else scene.history.recordEntry([op], label);
    },
    batch: (label, write, options = {}) => {
      batching += 1;
      try {
        scene.batch(
          label,
          write,
          options.coalesceKey === undefined ? {} : { coalesceKey: options.coalesceKey },
        );
      } finally {
        batching -= 1;
      }
    },
    serialize: (): SavedSceneHistory => ({
      history: scene.serializeHistory(),
      stamps: [...stamps],
    }),
    restore: (data, rebuild) => {
      const saved = data as Partial<SavedSceneHistory> | null;
      if (!saved?.history) return;
      // The scene rebuilds an entry the trial recorded through a kind registered on it, which hands
      // undo and redo the same args.
      scene.registerOp<unknown>(TRIAL_EDIT_OP, {
        apply: (args) => rebuild(TRIAL_EDIT_OP, args)?.apply(null),
        revert: (args) => rebuild(TRIAL_EDIT_OP, args)?.invert().apply(null),
      });
      scene.restoreHistory(saved.history);
      restoreStamps(stamps, saved.stamps, saved.history);
    },
  };
}
