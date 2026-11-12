import { useEffect } from 'react';
import type { NodeId } from 'core/scene/types';
import type { SelectionApi } from './useSelection';

/** `ids` as the scene's own selection would hold them (`Scene.selectable`). */
export type Selectable = (ids: readonly NodeId[]) => readonly NodeId[];

const views = new WeakMap<SelectionApi, { selectable: Selectable; view: SelectionApi }>();

/** Write `selectable(api.get())` back to `api` when it drops anything: what the scene does to its
 *  own selection when an edit removes, hides or locks a selected node. */
export function settleSelection(api: SelectionApi, selectable: Selectable): void {
  const ids = api.get();
  const kept = selectable(ids);
  if (kept !== ids) api.set([...kept]);
}

/**
 * A view of `api` that reads and writes only what `selectable` keeps, so a selection kept off
 * the scene holds what the scene's own would: no locked, hidden or missing node, and none held
 * by a selected ancestor. `api` itself is untouched and still writes as it did; what it holds
 * past that is not read through the view.
 *
 * One view per `api` and `selectable`, so it is as stable a memo or effect dependency as `api`.
 */
export function legalSelection(api: SelectionApi, selectable: Selectable): SelectionApi {
  const cached = views.get(api);
  if (cached && cached.selectable === selectable) return cached.view;
  const narrow = (ids: readonly NodeId[]) => [...selectable(ids)];
  const settle = (): void => { settleSelection(api, selectable); };
  // The last read, so an unchanged selection reads back as the same array.
  let from: readonly NodeId[] | null = null;
  let kept: NodeId[] = [];
  const read = (ids: readonly NodeId[]): NodeId[] => {
    if (ids !== from) {
      from = ids;
      const legal = selectable(ids);
      kept = (legal === ids ? ids : [...legal]) as NodeId[];
    }
    return kept;
  };
  const get = () => read(api.get());
  const view: SelectionApi = {
    get current() { return get(); },
    get,
    contains: (id) => get().includes(id),
    set: (ids) => api.set(narrow(ids)),
    add(id) { api.add(id); settle(); },
    remove: api.remove,
    toggle(id) { api.toggle(id); settle(); },
    clear: api.clear,
    applyClick(id, modifiers, between) { api.applyClick(id, modifiers, between); settle(); },
    intentOf: api.intentOf,
    adapterMethods: {
      getSelection: () => read(api.adapterMethods.getSelection()),
      setSelection: (ids) => api.adapterMethods.setSelection(narrow(ids)),
    },
  };
  views.set(api, { selectable, view });
  return view;
}

/** What {@link useLegalSelection} reads of a scene: its rule and its changes. */
export interface SelectionRules {
  selectable: Selectable;
  subscribe(listener: () => void): () => void;
}

/**
 * `api` kept to `rules` ({@link legalSelection}), and settled back to them on every change
 * `rules` reports ({@link settleSelection}), as the scene drops a node an edit removes, hides or
 * locks from its own selection. `api` itself, unwrapped, without `rules`.
 */
export function useLegalSelection(api: SelectionApi, rules: SelectionRules | undefined): SelectionApi {
  useEffect(() => {
    if (!rules) return undefined;
    const settle = () => { settleSelection(api, rules.selectable); };
    settle();
    return rules.subscribe(settle);
  }, [api, rules]);
  return rules ? legalSelection(api, rules.selectable) : api;
}
