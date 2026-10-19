/**
 * The scene's selection: the transient set of active ids. Not document
 * content, so it never reaches `toJSON`; it does ride on history entries.
 */
import type { HistorySelection } from '@weasel-js/history';
import { createEmitter } from '@weasel-js/registry';
import type { NodeId } from './types';

export interface SceneSelection {
  get(): readonly NodeId[];
  /** Select the ids of `ids` that are in reach, and tell subscribers. */
  set(ids: readonly NodeId[]): void;
  /** Drop the ids in `gone`, and any a lock has put out of reach. Tells no
   *  one: the edit that took them is what subscribers hear about. */
  narrow(gone?: ReadonlySet<NodeId>): void;
  /** Put a selection in place exactly as given, telling no one: for a caller
   *  returning what it read earlier, or one that has already filtered. */
  replace(ids: readonly NodeId[]): void;
  subscribe(listener: () => void): () => void;
  /** How many times subscribers have been told the selection changed. */
  changes(): number;
}

export function createSceneSelection(
  /** `ids` less those out of reach; the same array when none is. */
  reachable: (ids: readonly NodeId[]) => readonly NodeId[],
): SceneSelection {
  let ids: readonly NodeId[] = [];
  let changes = 0;
  const changed = createEmitter();

  return {
    get: () => ids,
    set(next) {
      ids = reachable(next);
      changes++;
      changed.emit();
    },
    narrow(gone) {
      // A new array only when one is dropped: readers compare the selection by identity.
      const kept = gone !== undefined && ids.some((id) => gone.has(id)) ? ids.filter((id) => !gone.has(id)) : ids;
      ids = reachable(kept);
    },
    replace(next) {
      ids = next;
    },
    subscribe: changed.subscribe,
    changes: () => changes,
  };
}

/** The scene's selection in the shape `createHistory` wants, for a consumer
 *  building a second History over the same scene (a modality machine, a
 *  journal owner) that should restore selection the way the scene's own
 *  history does. */
export function sceneSelectionStore(scene: {
  getSelection(): readonly NodeId[];
  setSelection(ids: readonly NodeId[]): void;
}): HistorySelection {
  return {
    get: () => scene.getSelection(),
    set: (ids) => scene.setSelection(ids as readonly NodeId[]),
  };
}
