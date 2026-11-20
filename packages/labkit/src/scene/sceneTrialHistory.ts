import type { Op, Scene, SerializedSceneHistory } from '@weasel-js/core';
import { maxOf } from '@weasel-js/geom';
import { createPart } from '@weasel-js/registry';
import { latestStamp } from '../state/savedUndo';
import { TRIAL_EDIT_OP } from '../trial/trialEditOp';
import type { TrialHistorySource } from '../trial/trialHistory';
import { editStamp, seedEditStamp } from '../undo/editStamp';

type AnyScene = Pick<Scene<unknown, string, unknown>, 'history'>;

/** The `editStamp`s kept for `scene`'s entries, one map per scene. */
export const editStampsOf = createPart((_scene: object) => new Map<number, number>());

/**
 * Stamps each entry `scene` records or merges into with `editStamp`, by id,
 * into `stamps`, so its steps order against the trial's marks to the
 * fraction of a millisecond where the scene's own timestamps are whole ones.
 * Returns the stop.
 */
export function stampSceneEdits(scene: AnyScene, stamps: Map<number, number>): () => void {
  return scene.history.observe((step) => {
    if (step.kind !== 'push' && step.kind !== 'coalesce') return;
    for (const entry of step.entries) stamps.set(entry.id, editStamp());
    const { undo, redo } = scene.history.entries();
    // Entries the scene let go of (dropped redo, its history limit) take their stamps with them.
    if (stamps.size > 2 * (undo.length + redo.length) + 16) {
      const held = new Set([...undo, ...redo].map((e) => e.id));
      for (const id of stamps.keys()) if (!held.has(id)) stamps.delete(id);
    }
  });
}

type Rebuild = (name: string, args: unknown) => Op | null;

/** The one `TRIAL_EDIT_OP` handler registered on each scene, rebuilding through the latest restore's `rebuild`:
 *  the op table refuses a second, different handler for a kind. */
const trialEditKindOf = createPart((scene: Pick<Scene<unknown, string, unknown>, 'registerOp'>) => {
  const kind = { rebuild: null as Rebuild | null };
  scene.registerOp<unknown>(TRIAL_EDIT_OP, {
    apply: (args) => kind.rebuild?.(TRIAL_EDIT_OP, args)?.apply(null),
    revert: (args) => kind.rebuild?.(TRIAL_EDIT_OP, args)?.invert().apply(null),
  });
  return kind;
});

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
  const stampOf = (side: 'undo' | 'redo'): number | undefined => {
    const { undo, redo } = scene.history.entries();
    const entry = side === 'undo' ? undo[undo.length - 1] : redo[0];
    return entry && (stamps.get(entry.id) ?? entry.timestamp);
  };
  // Inside a batch, a settings entry is applied as part of it, which joins it to the batch's entry.
  let batching = 0;
  return {
    canUndo: () => scene.canUndo(),
    canRedo: () => scene.canRedo(),
    undo: () => scene.undo(),
    redo: () => scene.redo(),
    undoStamp: () => stampOf('undo'),
    redoStamp: () => stampOf('redo'),
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
      trialEditKindOf(scene).rebuild = rebuild;
      scene.restoreHistory(saved.history);
      stamps.clear();
      for (const [id, stamp] of saved.stamps ?? []) stamps.set(id, stamp);
      seedEditStamp(Math.max(maxOf(stamps.values()), latestStamp(saved.history)));
    },
  };
}
