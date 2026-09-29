import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLatest } from '@weasel-js/routing/react';
import type { NodeId } from 'core/scene/types';
import { dlog } from 'debug/flag';

/**
 * `SelectionApi`, `SelectionMode` and `SelectionExtendKey` are declared in
 * `@weasel-js/routing` — the `selection` dep and half the kit's actions are
 * typed in them. Re-exported here, beside the hook that returns one.
 */
import type { SelectionApi, SelectionMode, SelectionExtendKey } from '@weasel-js/routing';
export type { SelectionApi, SelectionMode, SelectionExtendKey };

/** Somewhere selection can live outside this hook. `Scene` satisfies it;
 *  so does any store with the same three methods. */
export interface SelectionStore {
  getSelection(): readonly NodeId[];
  setSelection(ids: readonly NodeId[]): void;
  subscribe(listener: () => void): () => void;
}

/** Options for {@link useSelection}. */
export interface UseSelectionOptions {
  /** Default `'single'`. */
  mode?: SelectionMode;
  /** Default `'shift'`. Ignored in single-mode. */
  extend?: SelectionExtendKey;
  /** Default `[]`. */
  initial?: readonly NodeId[];
  /** Keep the selection on this store rather than in the hook, so every
   *  consumer of the same scene shares one selection and undo / redo can
   *  restore it. `initial` then only seeds a store that has none yet.
   *  Omit it and the hook owns a selection nobody else sees. */
  scene?: SelectionStore;
  /** When `true`, every mutator (`set`/`add`/`remove`/`toggle`/`clear`/
   *  `applyClick`) is a no-op — selection stays at whatever `initial`
   *  pinned it to. Useful for demos that exist to showcase a single
   *  pre-selected node and don't want a
   *  stray click to deselect. */
  lock?: boolean;
}

/** Where a hook with no `scene` keeps its selection, so `get()` reads one
 *  store either way and a write is visible before the re-render it causes. */
function createLocalStore(initial: readonly NodeId[]): SelectionStore {
  let ids: readonly NodeId[] = initial;
  const listeners = new Set<() => void>();
  return {
    getSelection: () => ids,
    setSelection: (next) => {
      ids = next;
      for (const l of listeners) l();
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}

/**
 * Default implementation of the `getSelection` / `setSelection` adapter
 * contract every action hook (delete, duplicate, nudge, group, ...) requires.
 *
 * Owns selection state, exposes a click-policy helper (single vs multi with
 * an extend key), and pre-builds the two adapter methods consumers otherwise
 * hand-roll in every demo:
 *
 * ```tsx
 * const selection = useSelection({ mode: 'multi' });
 * const adapter = { ...arrayAdapter({...}), ...selection.adapterMethods };
 * ```
 *
 * Returns the same object for as long as `scene` is the same store, so it is
 * safe as a memo or effect dependency. The calling component re-renders when
 * the selection changes; key anything derived from the ids on
 * `selection.current`.
 */
export function useSelection(opts: UseSelectionOptions = {}): SelectionApi {
  const { mode = 'single', extend = 'shift', initial = [], lock = false, scene } = opts;
  const [local] = useState(() => createLocalStore([...initial]));
  const store = scene ?? local;
  const initialRef = useRef(initial);

  useSyncExternalStore(store.subscribe, () => store.getSelection());

  // A store that already holds a selection wins: the hook is joining it, not
  // resetting it. In an effect, not during render — the store has other
  // subscribers.
  const seeded = useRef(false);
  useLayoutEffect(() => {
    if (!scene || seeded.current) return;
    seeded.current = true;
    if (initialRef.current.length > 0 && scene.getSelection().length === 0) {
      scene.setSelection([...initialRef.current]);
    }
  }, [scene]);

  const optsRef = useLatest({ mode, extend, lock });

  return useMemo<SelectionApi>(() => {
    const get = (): NodeId[] => store.getSelection() as NodeId[];
    const set = (ids: NodeId[]): void => {
      if (optsRef.current.lock) return;
      dlog('selection', 'set', { from: get().length, to: ids.length, ids });
      store.setSelection(ids);
    };
    const without = (id: NodeId) => get().filter((x) => x !== id);
    return {
      get current() { return get(); },
      get,
      set,
      add(id) {
        if (optsRef.current.mode === 'single') set([id]);
        else if (!get().includes(id)) set([...get(), id]);
      },
      remove(id) {
        if (get().includes(id)) set(without(id));
      },
      toggle(id) {
        if (get().includes(id)) set(without(id));
        else set(optsRef.current.mode === 'single' ? [id] : [...get(), id]);
      },
      clear() { set([]); },
      contains: (id) => get().includes(id),
      applyClick(id, modifiers) {
        const { mode: m, extend: key } = optsRef.current;
        if (m === 'multi' && modifiers[key]) set(get().includes(id) ? without(id) : [...get(), id]);
        else set([id]);
      },
      adapterMethods: {
        getSelection: () => get(),
        setSelection: (ids: NodeId[]) => set(ids),
      },
    };
  }, [store, optsRef]);
}
