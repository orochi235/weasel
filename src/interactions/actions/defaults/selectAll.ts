import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/** @experimental */
export interface SelectAllDeps {
  getSelection: () => NodeId[];
  listAll: () => NodeId[];
  /** Mutator that applies the new selection. Typically wired from
   *  `selection.adapterMethods.setSelection` in `<SceneCanvas>`. */
  setSelection: (ids: NodeId[]) => void;
}

/**
 * @experimental
 * Factory for the default `selectAll` Action. Run is a no-op when listAll() is empty.
 */
export function defaultSelectAllAction(deps: SelectAllDeps): Action {
  return {
    id: 'selectAll',
    label: 'Select All',
    defaultBinding: { key: 'a', mod: true },
    run: () => {
      const all = deps.listAll();
      if (all.length === 0) return;
      deps.setSelection(all);
    },
    enabled: () => (deps.listAll().length > 0 ? true : ActionDisabledReason.SceneEmpty),
  };
}
