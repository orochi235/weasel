import type { Node, NodeId, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import { createReparentOp } from 'core/ops/reparent';
import { unionBounds, type RectPose } from 'core/geometry/unionBounds';
import type { Action } from '../registry';
import { defaultCommitAdapter } from '../defaultCommitAdapter';

/** Mint a fresh NodeId for a new container. The old `scene.add(spec)` path
 *  (no explicit id) let the scene generate a random id, so the produced id
 *  was never deterministic/observable — pre-generating one here to feed the
 *  insert op preserves behavior. Mirrors the scene's default id scheme
 *  (`n{counter}-{random}`), which `core/scene/scene.ts` keeps module-private.
 *  Same approach as `cloneAction`. */
let containerIdCounter = 0;
function freshContainerId(): NodeId {
  return asNodeId(`n${(containerIdCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
}

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
  requires: ['scene', 'selection', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      const applyOps = deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
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

      // Build ops mirroring the old direct mutations, in the same order the
      // `scene.batch('Group', …)` body produced them:
      //   1. insert the fresh container (the old `scene.add` minted a random
      //      id; we pre-generate one so the insert op carries a full node —
      //      the id was never observable, so behavior is preserved);
      //   2. reparent each selected id under the new container, in selection
      //      order, capturing each node's PRE-mutation parent as `from`
      //      (the op captures the sibling slot itself, on apply).
      // The container must exist before any child reparents into it, so the
      // insert op is emitted first. Member poses are intentionally untouched
      // (absolute-pose model — reparenting alone doesn't move members).
      const containerId = freshContainerId();
      const ops: Op[] = [
        createInsertOp<Node<unknown, string, unknown>>({
          node: {
            id: containerId,
            kind: 'container',
            layer,
            pose: pose as unknown,
            data: {} as unknown,
            parent: parent ?? null,
          } as Node<unknown, string, unknown>,
          label: 'Group',
        }),
      ];
      for (const node of nodes) {
        ops.push(createReparentOp({
          id: node.id as string,
          fromParentId: (node.parent ?? null) as string | null,
          toParentId: containerId as string,
          label: 'Group',
        }));
      }

      // Route the batch through the consumer `applyOps` hook when present (so
      // an app with its own history captures the group as a single undo
      // entry); otherwise commit straight to the scene's own history via
      // `scene.applyBatch`. One applyOps / applyBatch call = one undo entry,
      // matching the prior single `scene.batch('Group', …)`.
      if (applyOps) applyOps(ops, 'Group');
      else scene.applyBatch(ops, 'Group', defaultCommitAdapter(scene));

      // Selection update is selection state, not a scene op — set it after the
      // commit regardless of which path ran (the old code set it inside the
      // batch; it was never an undoable scene mutation).
      selection.set([containerId]);
    },
  },
  enabled: () => true,
};

/**
 * @experimental
 * Static descriptor for the `ungroup` Action.
 *
 * "Group" here means a structural `ContainerNode`. `run` dissolves each
 * selected container by reparenting its children up to the container's own
 * parent (preserving z-order) and removing the now-empty container, as a single
 * undoable batch. Selected non-container nodes are ignored. The freed children
 * become the new selection.
 */
export const ungroupAction: Action & { requires: string[] } = {
  id: 'ungroup',
  label: 'Ungroup',
  defaultBinding: { kind: 'key', key: 'g', mods: { mod: true, shift: true } },
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

      const containers = ids.filter((id) => scene.get(id as NodeId)?.kind === 'container');
      if (containers.length === 0) return;

      scene.batch('Ungroup', () => {
        const freed: NodeId[] = [];
        for (const containerId of containers) {
          const container = scene.get(containerId as NodeId);
          if (!container || container.kind !== 'container') continue;

          const parent = container.parent ?? null;
          const baseIndex =
            parent === null
              ? scene.roots.indexOf(containerId as NodeId)
              : scene.childrenOf(parent).indexOf(containerId as NodeId);

          const children = [...scene.childrenOf(containerId as NodeId)];
          children.forEach((childId, i) => {
            scene.move(childId, parent, baseIndex < 0 ? undefined : baseIndex + i);
            freed.push(childId);
          });

          scene.remove(containerId as NodeId);
        }
        selection.set(freed);
      });
    },
  },
  enabled: () => true,
};
