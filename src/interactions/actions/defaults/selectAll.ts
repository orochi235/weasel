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
 * Static descriptor for the `selectAll` Action. Selects all scene nodes.
 */
export const selectAllAction: Action = {
  id: 'selectAll',
  label: 'Select All',
  gestureBinding: { kind: 'key', key: 'a', mods: { mod: true } },
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const scene = deps.scene as { listAll?: () => NodeId[] } | undefined;
      const all = scene?.listAll?.() ?? [];
      if (all.length === 0) return;
      (deps.selection as { set(ids: NodeId[]): void } | undefined)?.set(all);
    },
  },
};

/**
 * @experimental
 * Factory for the default `selectAll` Action. Run is a no-op when listAll() is empty.
 *
 * @deprecated Phase 4+: use `selectAllAction` directly. This wrapper is a
 * Phase 4–7 transition shim and will be removed in Phase 8.
 */
export function defaultSelectAllAction(deps: SelectAllDeps): Action {
  // Exclude `invoker` so the legacy run path stays active until Task 8.
  const { invoker: _invoker, ...descriptorFields } = selectAllAction;
  void _invoker;
  return {
    ...descriptorFields,
    run: () => {
      const all = deps.listAll();
      if (all.length === 0) return;
      deps.setSelection(all);
    },
    enabled: () => (deps.listAll().length > 0 ? true : ActionDisabledReason.SceneEmpty),
  };
}
