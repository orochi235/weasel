import { createEmitter } from '@weasel-js/registry';

/** Somewhere a selection can live outside the component that edits it. core's `Scene` satisfies
 *  it, and so does any store with the same three methods. */
export interface SelectionStore<K> {
  getSelection(): readonly K[];
  setSelection(ids: readonly K[]): void;
  subscribe(listener: () => void): () => void;
}

/** A {@link SelectionStore} holding the ids itself, each once. A listener reads the new value; a set
 *  that leaves the ids as they were tells no one and keeps the array readers hold. */
export function createSelectionStore<K>(initial: readonly K[] = []): SelectionStore<K> {
  let ids = once(initial);
  const changed = createEmitter();
  return {
    getSelection: () => ids,
    setSelection(next) {
      const kept = once(next);
      if (kept.length === ids.length && kept.every((id, i) => id === ids[i])) return;
      ids = kept;
      changed.emit();
    },
    subscribe: changed.subscribe,
  };
}

/** `ids` with each id once, at its first place; `ids` itself when none repeats. */
function once<K>(ids: readonly K[]): readonly K[] {
  if (ids.length < 2) return ids;
  const seen = new Set(ids);
  return seen.size === ids.length ? ids : [...seen];
}
