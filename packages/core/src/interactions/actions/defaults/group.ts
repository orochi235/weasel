import type { Node, NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import { createReparentOp } from 'core/ops/reparent';
import { unionBounds } from 'core/geometry/unionBounds';
import { unionOfChildren, UNION_OF_CHILDREN } from 'core/scene/kitRegistry';
import { poseDescriptorOf } from '../poseDescriptorDep';
import { visualBoundsViaDescriptor } from '../resize/geometry';
import { createTransformOp } from 'core/ops/transform';
import { ActionDisabledReason, type Action } from '@weasel-js/routing';
import { requiresSelection } from './requiresSelection';
import { scenePoseFrame } from '../poseFrame';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { icon } from '../../../icons.gen';

/**
 * Creates a structural `GroupNode` and reparents the current selection
 * under it as a single undoable batch.
 *
 * Grouping never moves a member on screen. The container takes the world
 * envelope of its members' ink; each member is then re-expressed in that
 * container's frame, which is a no-op only when the scene composes poses by
 * identity.
 *
 * Under identity the container's pose is also *derived* from its members, so
 * it tracks one that moves later. Under any other composition that derivation
 * is circular — the members' poses are expressed in the container's own
 * frame — so the container keeps the authored envelope instead.
 */
export const groupAction: Action & { requires: string[] } = {
  id: 'group',
  label: 'Group',
  icon: icon('group'),
  group: 'structure',
  defaultBinding: [{ spec: { kind: 'key', key: 'g', mods: { mod: true } }, opts: { id: 'group.key' } }],
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection', 'applyOps', 'poseDescriptor'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.selection;
      const scene = deps.scene;
      const applyOps = deps.applyOps;
      if (!selection || !scene) return;

      const ids = selection.get();
      if (ids.length === 0) return;

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

      // Under identity the authored pose is only the fallback (an emptied
      // group, a lost registry key); the derived union is what the scene shows.
      const d = poseDescriptorOf(deps.poseDescriptor);
      const frame = scenePoseFrame(scene);
      const worlds = new Map<NodeId, unknown>();
      for (const node of nodes) worlds.set(node.id, frame.world(node.id));
      // Visual, not stored, bounds: a turned member's ink reaches outside its
      // own box, and the container has to cover what is drawn.
      const union = unionBounds([...worlds.values()].map((p) => visualBoundsViaDescriptor(p, d)));
      const containerWorldPose = union === null
        ? nodes[0]!.pose
        : d.fromBounds(union, nodes[0]!.pose);
      const pose = frame.localUnder(parent, containerWorldPose);
      const absolutePoses = frame.pc.closure === 'identity';
      const derive = scene.registry.derivePose?.[UNION_OF_CHILDREN] ?? unionOfChildren;

      // The container must exist before any child reparents into it, so the
      // insert op is emitted first.
      const containerId = scene.mintId();
      const ops: Op[] = [
        createInsertOp<Node<unknown, string, unknown>>({
          node: {
            id: containerId,
            kind: 'group',
            layer,
            pose: pose as unknown,
            data: {} as unknown,
            parent: parent ?? null,
            ...(absolutePoses ? { dependsOn: 'children', derivePose: derive } : {}),
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
        if (absolutePoses) continue;
        ops.push(createTransformOp<unknown>({
          id: node.id as string,
          from: node.pose,
          to: frame.pc.decompose(containerWorldPose, worlds.get(node.id)!),
          label: 'Group',
        }));
      }

      if (applyOps) applyOps(ops, 'Group');
      else scene.applyBatch(ops, 'Group', defaultCommitAdapter(scene, selection.adapterMethods));

      selection.set([containerId]);
    },
  },
  enabled: requiresSelection,
};

/**
 * Dissolves each selected container by reparenting its children up to the
 * container's own parent (preserving z-order) and removing the now-empty
 * container, as a single undoable batch. Selected non-container nodes are
 * ignored. The freed children become the new selection, and nothing moves on
 * screen.
 */
export const ungroupAction: Action & { requires: string[] } = {
  id: 'ungroup',
  label: 'Ungroup',
  icon: icon('ungroup'),
  group: 'structure',
  defaultBinding: [{ spec: { kind: 'key', key: 'g', mods: { mod: true, shift: true } }, opts: { id: 'ungroup.key' } }],
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.selection;
      const scene = deps.scene;
      if (!selection || !scene) return;

      const ids = selection.get();
      if (ids.length === 0) return;

      const containers = ids.filter((id) => scene.get(id as NodeId)?.kind === 'group');
      if (containers.length === 0) return;

      const frame = scenePoseFrame(scene);
      const absolutePoses = frame.pc.closure === 'identity';

      scene.batch('Ungroup', () => {
        const freed: NodeId[] = [];
        for (const containerId of containers) {
          const container = scene.get(containerId as NodeId);
          if (!container || container.kind !== 'group') continue;

          const parent = container.parent ?? null;
          const baseIndex =
            parent === null
              ? scene.roots.indexOf(containerId as NodeId)
              : scene.childrenOf(parent).indexOf(containerId as NodeId);

          const children = [...scene.childrenOf(containerId as NodeId)];
          // Read every world pose before the first move: the frame resolves
          // through the live scene, and the container is about to leave it.
          const worlds = new Map<NodeId, unknown>();
          if (!absolutePoses) {
            for (const childId of children) worlds.set(childId, frame.world(childId));
          }
          children.forEach((childId, i) => {
            scene.move(childId, parent, baseIndex < 0 ? undefined : baseIndex + i);
            if (!absolutePoses) {
              scene.setPose(childId, frame.localUnder(parent, worlds.get(childId)!) as never);
            }
            freed.push(childId);
          });

          scene.remove(containerId as NodeId);
        }
        selection.set(freed);
      });
    },
  },
  enabled: (deps) => {
    const selection = deps?.selection;
    const scene = deps?.scene;
    const any = selection?.get().some((id) => scene?.get(id as NodeId)?.kind === 'group');
    return any ? true : ActionDisabledReason.NotApplicable;
  },
};
