import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';

/**
 * @experimental
 * Static descriptor for the `selectAll` Action. Selects all scene nodes.
 */
export const selectAllAction: Action & { requires: string[] } = {
  id: 'selectAll',
  label: 'Select All',
  defaultBinding: { kind: 'key', key: 'a', mods: { mod: true } },
  requires: ['scene', 'selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      // Scene exposes `renderOrder()` (bottom→top iterable of NodeIds), not
      // the never-implemented `listAll()`. Materialize once into an array
      // and forward to selection.
      const scene = deps.scene as { renderOrder?: () => Iterable<NodeId> } | undefined;
      const all = scene?.renderOrder ? [...scene.renderOrder()] : [];
      if (all.length === 0) return;
      (deps.selection as { set(ids: NodeId[]): void } | undefined)?.set(all);
    },
  },
};
