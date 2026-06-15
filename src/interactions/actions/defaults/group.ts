import type { NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { unionBounds, type RectPose } from 'features/groups/unionBounds';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/**
 * @experimental
 * Static descriptor for the `group` Action.
 *
 * "Group" here means a structural `ContainerNode` — the real group that
 * round-trips to SVG `<g>` — not the legacy membership-list. `run` creates a
 * fresh container and reparents the current selection under it as a single
 * undoable batch.
 *
 * Child poses are absolute by default (the container-pose cascade is opt-in),
 * so reparenting does NOT move the members visually. The container's own pose
 * is purely bounds/selection metadata: the union AABB of its members.
 */
export const groupAction: Action & { requires: string[] } = {
  id: 'group',
  label: 'Group',
  defaultBinding: { kind: 'key', key: 'g', mods: { mod: true } },
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      if (!selection || !scene) return;

      const ids = selection.get();
      if (ids.length === 0) return;

      // Resolve nodes; drop any that have gone missing.
      const nodes = ids
        .map((id) => scene.get(id as NodeId))
        .filter((n): n is NonNullable<typeof n> => n !== undefined);
      if (nodes.length === 0) return;

      // Members must share a layer — containers live on a single layer.
      const layers = new Set(nodes.map((n) => n.layer));
      if (layers.size > 1) return;
      const layer = nodes[0]!.layer;

      // Nest under the shared parent if the members agree, else at the root.
      const parents = new Set(nodes.map((n) => n.parent));
      const parent = parents.size === 1 ? nodes[0]!.parent : null;

      const pose =
        unionBounds(nodes.map((n) => n.pose as RectPose)) ?? { x: 0, y: 0, width: 0, height: 0 };

      scene.batch('Group', () => {
        const containerId = scene.add({
          kind: 'container',
          layer,
          pose: pose as unknown,
          data: {} as unknown,
          parent,
        });
        for (const id of ids) scene.move(id as NodeId, containerId);
        selection.set([containerId]);
      });
    },
  },
  enabled: () => true,
};

/**
 * @experimental
 * Static descriptor for the `ungroup` Action.
 */
export const ungroupAction: Action = {
  id: 'ungroup',
  label: 'Ungroup',
  defaultBinding: { kind: 'key', key: 'g', mods: { mod: true, shift: true } },
  eligible: { capability: 'edits-page' },
  invoker: {
    timing: 'immediate',
    run: (_deps, params) => {
      // Stub — depSchema wiring lives in useStandardActions.
      void params;
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
