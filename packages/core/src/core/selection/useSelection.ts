import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { NodeId } from 'core/scene/types';
import { dlog } from 'debug/flag';

/**
 * Selection click policy. `single` always replaces; `multi` toggles when the
 * configured extend key is held, otherwise replaces.
 */
export type SelectionMode = 'single' | 'multi';

/** Modifier key used to extend the selection in `multi` mode. */
export type SelectionExtendKey = 'shift' | 'meta' | 'ctrl';

/** API returned by {@link useSelection}. */
export interface SelectionApi {
  /** Current selection. Re-renders trigger when this reference changes. */
  current: readonly NodeId[];
  /** Imperative read for use inside event callbacks (avoids stale closures). */
  get(): NodeId[];
  /** Replace selection. */
  set(ids: NodeId[]): void;
  /** Add id (multi-mode appends; single-mode replaces). */
  add(id: NodeId): void;
  /** Remove id from selection. */
  remove(id: NodeId): void;
  /** Toggle id in/out of selection. */
  toggle(id: NodeId): void;
  /** Clear selection. */
  clear(): void;
  /** True if id is selected. */
  contains(id: NodeId): boolean;
  /**
   * Apply a click to the selection per the configured mode/extend key.
   * - `single`: replaces selection with `[id]`, regardless of modifiers.
   * - `multi`: with the extend key held, toggles `id` in/out of the selection;
   *   otherwise replaces with `[id]`.
   */
  applyClick(id: NodeId, modifiers: { shift: boolean; meta: boolean; ctrl: boolean }): void;
  /** Pre-built methods for spreading into an adapter that needs them. */
  adapterMethods: {
    getSelection: () => NodeId[];
    setSelection: (ids: NodeId[]) => void;
  };
}

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
   *  pre-selected node (e.g. the bezier-edit curve) and don't want a
   *  stray click to deselect. */
  lock?: boolean;
}

const EMPTY: readonly NodeId[] = [];
const EMPTY_SNAPSHOT = (): readonly NodeId[] => EMPTY;
const NEVER_CHANGES = (): (() => void) => () => {};

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
 */
export function useSelection(opts: UseSelectionOptions = {}): SelectionApi {
  const { mode = 'single', extend = 'shift', initial = [], lock = false, scene } = opts;
  const [local, setLocal] = useState<NodeId[]>(() => [...initial]);
  const storeRef = useRef<SelectionStore | undefined>(scene);
  storeRef.current = scene;
  const initialRef = useRef(initial);

  const fromStore = useSyncExternalStore(
    scene ? scene.subscribe : NEVER_CHANGES,
    scene ? () => scene.getSelection() : EMPTY_SNAPSHOT,
  );

  const current = (scene ? fromStore : local) as NodeId[];

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
  const ref = useRef<NodeId[]>(current);
  ref.current = current;
  // Keep the lock flag in a ref so the memoized mutators below don't have to
  // re-create when it toggles (and reading inside a stable closure is fine).
  const lockRef = useRef(lock);
  lockRef.current = lock;

  const get = useCallback(
    () => (storeRef.current ? (storeRef.current.getSelection() as NodeId[]) : ref.current),
    [],
  );

  const set = useCallback((ids: NodeId[]) => {
    if (lockRef.current) return;
    dlog('selection', 'set', { from: ref.current.length, to: ids.length, ids });
    ref.current = ids;
    const store = storeRef.current;
    if (store) store.setSelection(ids);
    else setLocal(ids);
  }, []);

  const add = useCallback(
    (id: NodeId) => {
      if (mode === 'single') {
        set([id]);
        return;
      }
      if (get().includes(id)) return;
      set([...get(), id]);
    },
    [get, mode, set],
  );

  const remove = useCallback(
    (id: NodeId) => {
      if (!get().includes(id)) return;
      set(get().filter((x) => x !== id));
    },
    [get, set],
  );

  const toggle = useCallback(
    (id: NodeId) => {
      if (get().includes(id)) {
        set(get().filter((x) => x !== id));
      } else {
        set(mode === 'single' ? [id] : [...get(), id]);
      }
    },
    [get, mode, set],
  );

  const clear = useCallback(() => {
    set([]);
  }, [set]);

  const contains = useCallback((id: NodeId) => get().includes(id), [get]);

  const applyClick = useCallback(
    (id: NodeId, modifiers: { shift: boolean; meta: boolean; ctrl: boolean }) => {
      if (mode === 'single') {
        set([id]);
        return;
      }
      const extending = modifiers[extend];
      if (extending) {
        if (get().includes(id)) {
          set(get().filter((x) => x !== id));
        } else {
          set([...get(), id]);
        }
      } else {
        set([id]);
      }
    },
    [get, mode, extend, set],
  );

  const adapterMethods = useMemo(
    () => ({
      getSelection: () => get(),
      setSelection: (ids: NodeId[]) => set(ids),
    }),
    [get, set],
  );

  return {
    current,
    get,
    set,
    add,
    remove,
    toggle,
    clear,
    contains,
    applyClick,
    adapterMethods,
  };
}
