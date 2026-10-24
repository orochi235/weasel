import type { NodeId } from 'core/scene/types';
import type { Action } from '@weasel-js/routing';
import { isAnnotationLayer } from 'core/scene/annotation';
import { nodeGates } from 'core/scene/nodeGates';
import { reachableInGroup } from 'canvas/deps/enteredGroup';

/**
 * Static descriptor for the `selectAll` Action. Selects every scene node the
 * user can see and reach — hidden and locked nodes (`nodeGates`), and nodes on
 * a layer the asking view does not paint, are left out, so Cmd+A then Delete cannot
 * take content that is off screen or locked. Inside an entered group it selects only what the
 * group holds.
 */
export const selectAllAction: Action & { requires: string[] } = {
  id: 'selectAll',
  label: 'Select All',
  defaultBinding: [{ spec: { kind: 'key', key: 'a', mods: { mod: true } }, opts: { id: 'selectAll.key' } }],
  eligible: { capability: 'creates-selection' },
  requires: ['scene', 'selection', 'view', 'enteredGroup'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const scene = deps.scene;
      const view = deps.view;
      if (!scene) return;
      // The node walk carries the layer each id sits on, which `view` gates.
      const gates = nodeGates(scene);
      const group = deps.enteredGroup?.get() ?? null;
      const all: NodeId[] = scene.renderOrderNodes()
        .filter((n) => reachableInGroup(scene, group, n.id)
          && !isAnnotationLayer(scene.layers.find((l) => l.id === n.layer))
          && view?.layerIsPainted?.(n.layer) !== false
          && !gates.hidden(n.id)
          && !gates.locked(n.id))
        .map((n) => n.id);
      if (all.length === 0) return;
      deps.selection?.set(all);
    },
  },
};
