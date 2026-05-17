import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';

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
