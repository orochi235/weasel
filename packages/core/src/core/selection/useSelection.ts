import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLatest } from '@weasel-js/react';
import { createSelectionStore, intentOf, select, type SelectionStore as Store } from '@weasel-js/select';
import type { NodeId } from 'core/scene/types';
import { dlog } from 'debug/flag';

/** Declared in `@weasel-js/routing`; re-exported here, beside the hook that returns one. */
import type { SelectionApi, SelectionMode, SelectionExtendKey } from '@weasel-js/routing';
export type { SelectionApi, SelectionMode, SelectionExtendKey };

/** Somewhere selection can live outside this hook. `Scene` satisfies it;
 *  so does any store with the same three methods. */
export type SelectionStore = Store<NodeId>;

/** Options for {@link useSelection}. */
export interface UseSelectionOptions {
  /** Default `'single'`. */
  mode?: SelectionMode;
  /** Default `'shift'`. Ignored in single-mode. */
  extend?: SelectionExtendKey;
  /** The key that selects everything from the last pressed id to this one,
   *  along `order`. Absent, nothing ranges. It beats `extend` when both name
   *  one key, so give them different keys. Ignored in single-mode. */
  range?: SelectionExtendKey;
  /** The sequence a range walks: a layer panel's rows, a timeline's tracks.
   *  Default is the order the `scene` paints in, back to front; with neither,
   *  the range key replaces. */
  order?: () => Iterable<NodeId>;
  /** Default `[]`. */
  initial?: readonly NodeId[];
  /** Keep the selection on this store rather than in the hook, so every
   *  consumer of the same scene shares one selection and undo / redo can
   *  restore it. `initial` then only seeds a store that has none yet.
   *  Omit it and the hook owns a selection nobody else sees. */
  scene?: SelectionStore;
  /** When `true`, every mutator (`set`/`add`/`remove`/`toggle`/`clear`/
   *  `applyClick`) is a no-op — selection stays at whatever `initial`
   *  pinned it to. */
  lock?: boolean;
}

/** The order a store paints its nodes in, when it is a scene and has one. */
function paintOrderOf(store: SelectionStore): (() => Iterable<NodeId>) | undefined {
  const { renderOrder } = store as { renderOrder?: () => Iterable<NodeId> };
  return typeof renderOrder === 'function' ? () => renderOrder.call(store) : undefined;
}

/**
 * Owns selection state, exposes a click-policy helper (single vs multi with
 * an extend key), and pre-builds the `getSelection` / `setSelection` adapter
 * methods:
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
  const { mode = 'single', extend = 'shift', initial = [], lock = false, scene, range, order } = opts;
  // Without a `scene` the hook still keeps its ids in a store, so `get()` reads one store either
  // way and a write is visible before the re-render it causes.
  const [local] = useState(() => createSelectionStore<NodeId>([...initial]));
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

  const optsRef = useLatest({ mode, extend, lock, range, order });
  const anchorRef = useRef<NodeId | null>(null);

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
        const { mode: m, extend: key, range: rangeKey, order: walk = paintOrderOf(store), lock: locked } = optsRef.current;
        if (locked) return;
        const ids = get();
        // A selection something else set — a marquee, an undo — ranges from its last id.
        const anchor = anchorRef.current !== null && ids.includes(anchorRef.current)
          ? anchorRef.current
          : (ids.at(-1) ?? null);
        const intent = intentOf(modifiers, { mode: m, toggle: key, range: rangeKey });
        const next = select({ ids, anchor }, id, intent, intent === 'range' && walk ? { order: [...walk()] } : {});
        anchorRef.current = next.anchor;
        set([...next.ids]);
      },
      adapterMethods: {
        getSelection: () => get(),
        setSelection: (ids: NodeId[]) => set(ids),
      },
    };
  }, [store, optsRef]);
}
