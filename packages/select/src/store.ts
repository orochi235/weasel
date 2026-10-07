/** Somewhere a selection can live outside the component that edits it. core's `Scene` satisfies
 *  it, and so does any store with the same three methods. */
export interface SelectionStore<K> {
  getSelection(): readonly K[];
  setSelection(ids: readonly K[]): void;
  subscribe(listener: () => void): () => void;
}

/** A {@link SelectionStore} holding the ids itself. A listener reads the new value. */
export function createSelectionStore<K>(initial: readonly K[] = []): SelectionStore<K> {
  let ids = initial;
  const listeners = new Set<() => void>();
  return {
    getSelection: () => ids,
    setSelection(next) {
      ids = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
