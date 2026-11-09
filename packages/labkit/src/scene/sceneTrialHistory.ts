import type { Scene } from '@weasel-js/core';
import type { TrialHistorySource } from '../trial/trialHistory';
import { editStamp } from '../undo/editStamp';

type AnyScene = Pick<Scene<unknown, string, unknown>, 'history'>;

const kept = new WeakMap<object, Map<number, number>>();

/** The `editStamp`s kept for `scene`'s entries, one map per scene. */
export function editStampsOf(scene: object): Map<number, number> {
  const known = kept.get(scene);
  if (known) return known;
  const stamps = new Map<number, number>();
  kept.set(scene, stamps);
  return stamps;
}

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

/** A scene's history as a trial steps it, taking the trial's settings entries
 *  onto the scene's own stack so one undo order covers both. Each step is
 *  stamped from `stamps` (`stampSceneEdits`), else from the scene's own
 *  timestamp. */
export function sceneTrialHistory<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  stamps: ReadonlyMap<number, number> = new Map(),
): TrialHistorySource {
  const stampOf = (side: 'undo' | 'redo'): number | undefined => {
    const { undo, redo } = scene.history.entries();
    const entry = side === 'undo' ? undo[undo.length - 1] : redo[0];
    return entry && (stamps.get(entry.id) ?? entry.timestamp);
  };
  return {
    canUndo: () => scene.canUndo(),
    canRedo: () => scene.canRedo(),
    undo: () => scene.undo(),
    redo: () => scene.redo(),
    undoStamp: () => stampOf('undo'),
    redoStamp: () => stampOf('redo'),
    dropRedo: () => scene.history.dropRedo(),
    subscribe: (listener) => scene.subscribe(listener),
    record: (op, label) => scene.history.recordEntry([op], label),
  };
}
