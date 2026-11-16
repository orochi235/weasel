import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLatest } from '@weasel-js/react';
import { createSelectionStore, intentOf, select, type SelectContext } from '@weasel-js/select';
import type { SelectionFactory, SelectionOptions, SelectionStore } from '@weasel-js/core/engine';
import { modKey } from '@weasel-js/gestures';
import type { NodeId } from '@weasel-js/core';
import { dlog } from '@weasel-js/core';
import type { SelectionApi } from '@weasel-js/routing';

/** Options for {@link useSelection}: a {@link SelectionOptions}, and the store to keep it on. */
export interface UseSelectionOptions extends SelectionOptions {
  /** Keep the selection on this store rather than in the hook, so every
   *  consumer of the same scene shares one selection and undo / redo can
   *  restore it. `initial` then only seeds a store that has none yet.
   *  Omit it and the hook owns a selection nobody else sees. */
  scene?: SelectionStore;
}

/** What a range press resolves against: the surface's own `between`, else the order to walk. */
function rangeContext(
  between: ((from: NodeId, to: NodeId) => readonly NodeId[]) | undefined,
  walk: (() => Iterable<NodeId>) | undefined,
): SelectContext<NodeId> {
  if (between) return { between };
  return walk ? { order: [...walk()] } : {};
}

/** The order a store paints its nodes in, when it is a scene and has one. */
function paintOrderOf(store: SelectionStore): (() => Iterable<NodeId>) | undefined {
  const { renderOrder } = store as { renderOrder?: () => Iterable<NodeId> };
  return typeof renderOrder === 'function' ? () => renderOrder.call(store) : undefined;
}

/**
 * The kit's selection over `store`, with its click policy (single, or multi with an extend and a range key)
 * read from `options()` at each write: the {@link SelectionFactory} editing's presets hand a canvas. Not a
 * hook; the caller re-renders on the store's changes itself.
 */
export const createSelection: SelectionFactory = (store, options) => {
  let anchor: NodeId | null = null;
  const policy = () => {
    const { mode = 'single', extend = modKey(), lock = false, order } = options();
    const range = options().range ?? (extend === 'shift' ? undefined : 'shift');
    return { mode, extend, lock, range, order };
  };
  const get = (): NodeId[] => store.getSelection() as NodeId[];
  const set = (ids: NodeId[]): void => {
    if (policy().lock) return;
    dlog('selection', 'set', { from: get().length, to: ids.length, ids });
    store.setSelection(ids);
  };
  const without = (id: NodeId) => get().filter((x) => x !== id);
  const intentOfMods: SelectionApi['intentOf'] = (modifiers) => {
    const { mode, extend, range } = policy();
    return intentOf(modifiers, { mode, toggle: extend, range });
  };
  return {
    get current() { return get(); },
    get,
    set,
    add(id) {
      if (policy().mode === 'single') set([id]);
      else if (!get().includes(id)) set([...get(), id]);
    },
    remove(id) {
      if (get().includes(id)) set(without(id));
    },
    toggle(id) {
      if (get().includes(id)) set(without(id));
      else set(policy().mode === 'single' ? [id] : [...get(), id]);
    },
    clear() { set([]); },
    contains: (id) => get().includes(id),
    applyClick(id, modifiers, between) {
      const { order: walk = paintOrderOf(store), lock } = policy();
      if (lock) return;
      const ids = get();
      // A selection something else set — a marquee, an undo — ranges from its last id.
      const from = anchor !== null && ids.includes(anchor) ? anchor : (ids.at(-1) ?? null);
      const intent = intentOfMods(modifiers);
      const next = select({ ids, anchor: from }, id, intent, intent === 'range' ? rangeContext(between, walk) : {});
      anchor = next.anchor;
      set([...next.ids]);
    },
    intentOf: intentOfMods,
    adapterMethods: {
      getSelection: () => get(),
      setSelection: (ids: NodeId[]) => set(ids),
    },
  };
};

/**
 * Owns selection state, exposes a click-policy helper (single vs multi with
 * an extend key), and pre-builds the `getSelection` / `setSelection` adapter
 * methods:
 *
 * ```tsx
 * const selection = useSelection({ mode: 'multi' });
 * const adapter = useSceneAdapter(scene, { selection: selection.adapterMethods });
 * ```
 *
 * Returns the same object for as long as `scene` is the same store, so it is
 * safe as a memo or effect dependency. The calling component re-renders when
 * the selection changes; key anything derived from the ids on
 * `selection.current`.
 */
export function useSelection(opts: UseSelectionOptions = {}): SelectionApi {
  const { initial = [], scene } = opts;
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

  const live = useLatest(opts);
  return useMemo(() => createSelection(store, () => live.current), [store, live]);
}
