import type { NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Action } from '../registry';

/**
 * @experimental
 * Static descriptor for the `delete` Action. Removes every selected
 * node from the scene as a single batched op (one undo entry).
 */
export const deleteAction: Action & { requires: string[] } = {
  id: 'delete',
  label: 'Delete',
  defaultBinding: { kind: 'key', key: ['Delete', 'Backspace'] },
  requires: ['scene', 'selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      if (!selection || !scene) return;
      const ids = selection.get();
      if (ids.length === 0) return;
      scene.batch('Delete', () => {
        for (const id of ids) scene.remove(id as NodeId);
      });
      selection.set([]);
    },
  },
  enabled: () => true,
};
