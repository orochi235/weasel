import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';

/** The slice of a scene this action reads. Structural, so a consumer store
 *  that answers these three is a valid `scene` dep without being a `Scene`. */
interface SelectAllScene {
  renderOrder?: () => Iterable<NodeId>;
  renderOrderNodes?: () => readonly { id: NodeId; layer: string }[];
  layers?: readonly { id: string; visible: boolean }[];
}

/**
 * @experimental
 * Static descriptor for the `selectAll` Action. Selects every scene node the
 * user can see — nodes on a hidden layer are left out, so Cmd+A then Delete
 * cannot take content that is not on screen.
 */
export const selectAllAction: Action & { requires: string[] } = {
  id: 'selectAll',
  label: 'Select All',
  defaultBinding: { kind: 'key', key: 'a', mods: { mod: true } },
  eligible: { capability: 'creates-selection' },
  requires: ['scene', 'selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const scene = deps.scene as SelectAllScene | undefined;
      const hidden = new Set(
        (scene?.layers ?? []).filter((l) => !l.visible).map((l) => l.id),
      );
      // Scene exposes `renderOrder()` (bottom→top iterable of NodeIds), not
      // the never-implemented `listAll()`. The node walk is the same sequence
      // and carries the layer each id sits on, which the id walk cannot.
      const all: NodeId[] = hidden.size === 0 || !scene?.renderOrderNodes
        ? (scene?.renderOrder ? [...scene.renderOrder()] : [])
        : scene.renderOrderNodes().filter((n) => !hidden.has(n.layer)).map((n) => n.id);
      if (all.length === 0) return;
      (deps.selection as { set(ids: NodeId[]): void } | undefined)?.set(all);
    },
  },
};
