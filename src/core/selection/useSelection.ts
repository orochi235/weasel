import { useCallback, useMemo, useRef, useState } from 'react';
import type { NodeId } from 'core/scene/types';

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

/** Options for {@link useSelection}. */
export interface UseSelectionOptions {
  /** Default `'single'`. */
  mode?: SelectionMode;
  /** Default `'shift'`. Ignored in single-mode. */
  extend?: SelectionExtendKey;
  /** Default `[]`. */
  initial?: readonly NodeId[];
  /** When `true`, every mutator (`set`/`add`/`remove`/`toggle`/`clear`/
   *  `applyClick`) is a no-op — selection stays at whatever `initial`
   *  pinned it to. Useful for demos that exist to showcase a single
   *  pre-selected node (e.g. the bezier-edit curve) and don't want a
   *  stray click to deselect. */
  lock?: boolean;
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
 */
export function useSelection(opts: UseSelectionOptions = {}): SelectionApi {
  const { mode = 'single', extend = 'shift', initial = [], lock = false } = opts;
  const [current, setCurrent] = useState<NodeId[]>(() => [...initial]);
  const ref = useRef<NodeId[]>(current);
  ref.current = current;
  // Keep the lock flag in a ref so the memoized mutators below don't have to
  // re-create when it toggles (and reading inside a stable closure is fine).
  const lockRef = useRef(lock);
  lockRef.current = lock;

  const get = useCallback(() => ref.current, []);

  const set = useCallback((ids: NodeId[]) => {
    if (lockRef.current) return;
    ref.current = ids;
    setCurrent(ids);
  }, []);

  const add = useCallback(
    (id: NodeId) => {
      if (mode === 'single') {
        set([id]);
        return;
      }
      if (ref.current.includes(id)) return;
      set([...ref.current, id]);
    },
    [mode, set],
  );

  const remove = useCallback(
    (id: NodeId) => {
      if (!ref.current.includes(id)) return;
      set(ref.current.filter((x) => x !== id));
    },
    [set],
  );

  const toggle = useCallback(
    (id: NodeId) => {
      if (ref.current.includes(id)) {
        set(ref.current.filter((x) => x !== id));
      } else {
        set(mode === 'single' ? [id] : [...ref.current, id]);
      }
    },
    [mode, set],
  );

  const clear = useCallback(() => {
    set([]);
  }, [set]);

  const contains = useCallback((id: NodeId) => ref.current.includes(id), []);

  const applyClick = useCallback(
    (id: NodeId, modifiers: { shift: boolean; meta: boolean; ctrl: boolean }) => {
      if (mode === 'single') {
        set([id]);
        return;
      }
      const extending = modifiers[extend];
      if (extending) {
        if (ref.current.includes(id)) {
          set(ref.current.filter((x) => x !== id));
        } else {
          set([...ref.current, id]);
        }
      } else {
        set([id]);
      }
    },
    [mode, extend, set],
  );

  const adapterMethods = useMemo(
    () => ({
      getSelection: () => ref.current,
      setSelection: (ids: NodeId[]) => set(ids),
    }),
    [set],
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
