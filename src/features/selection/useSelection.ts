import { useCallback, useMemo, useRef, useState } from 'react';

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
  current: string[];
  /** Imperative read for use inside event callbacks (avoids stale closures). */
  get(): string[];
  /** Replace selection. */
  set(ids: string[]): void;
  /** Add id (multi-mode appends; single-mode replaces). */
  add(id: string): void;
  /** Remove id from selection. */
  remove(id: string): void;
  /** Toggle id in/out of selection. */
  toggle(id: string): void;
  /** Clear selection. */
  clear(): void;
  /** True if id is selected. */
  contains(id: string): boolean;
  /**
   * Apply a click to the selection per the configured mode/extend key.
   * - `single`: replaces selection with `[id]`, regardless of modifiers.
   * - `multi`: with the extend key held, toggles `id` in/out of the selection;
   *   otherwise replaces with `[id]`.
   */
  applyClick(id: string, modifiers: { shift: boolean; meta: boolean; ctrl: boolean }): void;
  /** Pre-built methods for spreading into an adapter that needs them. */
  adapterMethods: {
    getSelection: () => string[];
    setSelection: (ids: string[]) => void;
  };
}

/** Options for {@link useSelection}. */
export interface UseSelectionOptions {
  /** Default `'single'`. */
  mode?: SelectionMode;
  /** Default `'shift'`. Ignored in single-mode. */
  extend?: SelectionExtendKey;
  /** Default `[]`. */
  initial?: string[];
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
  const { mode = 'single', extend = 'shift', initial = [] } = opts;
  const [current, setCurrent] = useState<string[]>(initial);
  const ref = useRef<string[]>(current);
  ref.current = current;

  const get = useCallback(() => ref.current, []);

  const set = useCallback((ids: string[]) => {
    ref.current = ids;
    setCurrent(ids);
  }, []);

  const add = useCallback(
    (id: string) => {
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
    (id: string) => {
      if (!ref.current.includes(id)) return;
      set(ref.current.filter((x) => x !== id));
    },
    [set],
  );

  const toggle = useCallback(
    (id: string) => {
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

  const contains = useCallback((id: string) => ref.current.includes(id), []);

  const applyClick = useCallback(
    (id: string, modifiers: { shift: boolean; meta: boolean; ctrl: boolean }) => {
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
      setSelection: (ids: string[]) => set(ids),
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
