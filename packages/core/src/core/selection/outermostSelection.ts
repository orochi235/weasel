import { outermost, type ParentOf } from '@weasel-js/select';
import type { NodeId } from 'core/scene/types';
import type { SelectionApi } from './useSelection';

const views = new WeakMap<SelectionApi, { parentOf: ParentOf<NodeId>; view: SelectionApi }>();

/**
 * A view of `api` whose every write keeps only the outermost ids under `parentOf`, so a
 * selection kept off the scene holds a selected node's subtree the way the scene's own does.
 * `api` itself is untouched and still writes as it did.
 *
 * One view per `api` and `parentOf`, so it is as stable a memo or effect dependency as `api`.
 */
export function outermostSelection(api: SelectionApi, parentOf: ParentOf<NodeId>): SelectionApi {
  const cached = views.get(api);
  if (cached && cached.parentOf === parentOf) return cached.view;
  const narrow = (ids: readonly NodeId[]) => outermost(ids, parentOf) as NodeId[];
  const set = (ids: NodeId[]): void => api.set(narrow(ids));
  const settle = (): void => {
    const ids = api.get();
    const kept = narrow(ids);
    if (kept !== ids) api.set(kept);
  };
  const view: SelectionApi = {
    get current() { return api.current; },
    get: api.get,
    contains: api.contains,
    set,
    add(id) { api.add(id); settle(); },
    remove: api.remove,
    toggle(id) { api.toggle(id); settle(); },
    clear: api.clear,
    applyClick(id, modifiers) { api.applyClick(id, modifiers); settle(); },
    adapterMethods: {
      getSelection: api.adapterMethods.getSelection,
      setSelection: (ids) => api.adapterMethods.setSelection(narrow(ids)),
    },
  };
  views.set(api, { parentOf, view });
  return view;
}
