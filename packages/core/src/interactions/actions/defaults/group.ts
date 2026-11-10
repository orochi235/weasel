import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import { createReparentOp } from 'core/ops/reparent';
import { createDeleteOp } from 'core/ops/delete';
import { createSetDependsOnOp } from 'core/ops/setDependsOn';
import { withoutPageStructure } from 'core/scene/nodeGates';
import { groupingSite } from 'core/pages/pagePlacement';
import { pageOfNode } from 'core/pages/pageNodes';
import { followerMoveOps, followerMoves } from '../followerMoves';
import { translatePoseViaDescriptor } from 'core/geometry/poseDescriptor';
import { unionBounds } from 'core/geometry/unionBounds';
import { poseDescriptorOf } from '../poseDescriptorDep';
import { visualBoundsViaDescriptor } from '../resize/geometry';
import { createTransformOp } from 'core/ops/transform';
import { ActionDisabledReason, type Action } from '@weasel-js/routing';
import { requiresContent, selectedContent } from './requiresSelection';
import { scenePoseFrame } from '../poseFrame';
import { commitOps } from '../defaultCommitAdapter';
import { inPaintOrder, slotAbove } from '../groupSlot';
import { icon } from '../../../icons.gen';
import { BETWEEN_GESTURES } from '@weasel-js/routing';

/**
 * Creates a structural `GroupNode` and reparents the current selection
 * under it as a single undoable batch, in the container `groupingSite` names,
 * in the frontmost member's place, the members keeping their stacking.
 *
 * Grouping never moves a member on screen, unless with the pasteboard off
 * the members lie wholly off every page and move onto one. The container takes the world
 * envelope of its members' ink, and each member is re-expressed in that
 * container's frame. The container is a frame, so its pose is authored rather
 * than derived from its members, whose poses are expressed in it. A node
 * following a member that changes page goes where `followerMoves` says.
 */
export const groupAction: Action & { requires: string[] } = {
  id: 'group',
  label: 'Group',
  icon: icon('group'),
  group: 'structure',
  defaultBinding: [{ spec: { kind: 'key', key: 'g', mods: { mod: true }, phase: BETWEEN_GESTURES }, opts: { id: 'group.key' } }],
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection', 'applyOps', 'poseDescriptor'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.selection;
      const scene = deps.scene;
      if (!selection || !scene) return;

      const ids = withoutPageStructure(scene, selection.get() as readonly NodeId[]);
      if (ids.length === 0) return;

      const nodes = inPaintOrder(scene, ids
        .map((id) => scene.get(id as NodeId))
        .filter((n): n is NonNullable<typeof n> => n !== undefined));
      if (nodes.length === 0) return;

      // Members must share a layer — containers live on a single layer.
      const layers = new Set(nodes.map((n) => n.layer));
      if (layers.size > 1) return;
      const layer = nodes[0]!.layer;

      const d = poseDescriptorOf(deps.poseDescriptor);
      const frame = scenePoseFrame(scene);
      const worlds = new Map<NodeId, unknown>();
      for (const node of nodes) worlds.set(node.id, frame.world(node.id));
      // Visual, not stored, bounds: a turned member's ink reaches outside its
      // own box, and the container has to cover what is drawn.
      const drawn = unionBounds([...worlds.values()].map((p) => visualBoundsViaDescriptor(p, d)));
      const { parent, shift } = groupingSite(scene, nodes.map((n) => n.id), drawn);
      if (shift.dx !== 0 || shift.dy !== 0) {
        for (const [id, p] of worlds) worlds.set(id, translatePoseViaDescriptor(p, shift.dx, shift.dy, d));
      }
      const union = drawn && { ...drawn, x: drawn.x + shift.dx, y: drawn.y + shift.dy };
      const containerWorldPose = union === null
        ? nodes[0]!.pose
        : d.fromBounds(union, nodes[0]!.pose);
      const pose = frame.localUnder(parent, containerWorldPose);

      // The container must exist before any child reparents into it, so the
      // insert op is emitted first.
      const containerId = scene.mintId();
      const index = slotAbove(scene, parent, nodes.at(-1)!.id);
      const ops: Op[] = [
        createInsertOp<Node<unknown, string, unknown>>({
          node: {
            id: containerId,
            kind: 'group',
            layer,
            pose: pose as unknown,
            data: {} as unknown,
            parent: parent ?? null,
          } as Node<unknown, string, unknown>,
          ...(index !== undefined ? { index } : {}),
          label: 'Group',
        }),
      ];
      nodes.forEach((node, i) => {
        ops.push(createReparentOp({
          id: node.id as string,
          fromParentId: (node.parent ?? null) as string | null,
          toParentId: containerId as string,
          toIndex: i,
          label: 'Group',
        }));
        ops.push(createTransformOp<unknown>({
          id: node.id as string,
          from: node.pose,
          to: frame.pc.decompose(containerWorldPose, worlds.get(node.id)!),
          label: 'Group',
        }));
      });

      const page = parent === null ? null : pageOfNode(scene, parent);
      ops.push(...followerMoveOps(followerMoves(scene, new Map(nodes.map((n) => [n.id as string, page]))), 'Group'));

      commitOps(deps, ops, 'Group', { select: [containerId] });
    },
  },
  enabled: requiresContent(1),
};

/** Whether ungrouping `node` dissolves it: a group, or a boolean group, which releases its operands. */
const dissolves = (node: { kind: string; consumesChildren?: boolean } | undefined): boolean =>
  node?.kind === 'group' || node?.consumesChildren === true;

type AnyScene = Scene<unknown, string, unknown>;

/** What ungrouping `containers` touches besides moving their children: the nodes that derive from one of them,
 *  each with the `dependsOn` it keeps. Ungroup removes the containers from every such list, so deleting a container
 *  takes nothing with it (ruled 2026-11-09). */
function releasedDerivations(scene: AnyScene, containers: readonly NodeId[]): Map<NodeId, readonly NodeId[] | undefined> {
  const dissolving = new Set<NodeId>(containers);
  const out = new Map<NodeId, readonly NodeId[] | undefined>();
  for (const node of scene.nodes.values()) {
    const from = node.dependsOn;
    if (dissolving.has(node.id) || !Array.isArray(from) || !from.some((id) => dissolving.has(id))) continue;
    const kept = (from as readonly NodeId[]).filter((id) => !dissolving.has(id));
    out.set(node.id, kept.length > 0 ? kept : undefined);
  }
  return out;
}

interface UngroupPlan {
  containers: NodeId[];
  /** The children ungrouping frees, outermost container first. */
  freed: NodeId[];
  released: Map<NodeId, readonly NodeId[] | undefined>;
  /** A node it would move, rewrite, or remove is locked: then it is disabled (ruled 2026-11-09). */
  locked: boolean;
}

/** What ungrouping the selected `ids` does, or null when none dissolves. `enabled` and `run` both read this, so
 *  they agree. */
function ungroupPlan(scene: AnyScene | undefined, ids: readonly NodeId[]): UngroupPlan | null {
  if (!scene) return null;
  const containers = ids.filter((id) => dissolves(scene.get(id)));
  if (containers.length === 0) return null;
  const dissolving = new Set(containers);
  const depth = (id: NodeId): number => scene.ancestorsOf(id).length;
  const freed = [...containers].sort((x, y) => depth(x) - depth(y))
    .flatMap((id) => scene.childrenOf(id).filter((kid) => !dissolving.has(kid)));
  const released = releasedDerivations(scene, containers);
  const touched = [...containers, ...freed, ...released.keys()];
  return { containers, freed, released, locked: touched.some((id) => scene.isLocked(id)) };
}

/** The batch dissolving `plan`'s containers, outermost first: each child moved up and re-expressed in its new
 *  frame, every derivation from a container dropped, then the containers removed. */
function ungroupOps(scene: AnyScene, plan: UngroupPlan): Op[] {
  const { containers } = plan;
  const frame = scenePoseFrame(scene);
  const dissolving = new Set<string>(containers);
  const depth = (id: string): number => scene.ancestorsOf(id as NodeId).length;
  // Where a container's children go: its parent, or past it when that dissolves too, which an
  // outer container, handled first, has by then.
  const landing = (id: string): NodeId | null => {
    let at = scene.get(id as NodeId)!.parent ?? null;
    while (at !== null && dissolving.has(at)) at = scene.get(at)!.parent ?? null;
    return at;
  };
  const moves: Op[] = [];
  const removals: Op[] = [];
  for (const containerId of [...containers].sort((x, y) => depth(x) - depth(y))) {
    const container = scene.get(containerId)!;
    const parent = landing(containerId);
    const index = (parent === null ? scene.roots : scene.childrenOf(parent)).indexOf(containerId);
    // Each child lands just under the container, in order, wherever the container then sits.
    for (const childId of scene.childrenOf(containerId)) {
      moves.push(createReparentOp({
        id: childId as string,
        fromParentId: containerId as string,
        toParentId: parent as string | null,
        toSlot: { index, before: containerId as string },
        label: 'Ungroup',
      }));
      moves.push(createTransformOp<unknown>({
        id: childId as string,
        from: scene.get(childId)!.pose,
        to: frame.localUnder(parent, frame.world(childId)),
        label: 'Ungroup',
      }));
    }
    removals.push(createDeleteOp({ node: { ...container, parent }, index, label: 'Ungroup' }));
  }
  const cuts = [...plan.released].map(([id, to]) =>
    createSetDependsOnOp({ id, from: scene.get(id)!.dependsOn as readonly NodeId[], to, label: 'Ungroup' }));
  return [...moves, ...cuts, ...removals];
}

/**
 * Dissolves each selected group, or boolean group, by reparenting its children up to the
 * container's own parent (preserving z-order) and removing the now-empty
 * container, as a single undoable batch. Selected marks, children or not, are
 * ignored. The freed children become the new selection, and nothing moves on
 * screen. Every node deriving from a dissolved container, a freed child or not, drops that container from its
 * `dependsOn`, so the batch removes the containers and nothing else. Disabled while any node it would move,
 * rewrite, or remove is locked.
 */
export const ungroupAction: Action & { requires: string[] } = {
  id: 'ungroup',
  label: 'Ungroup',
  icon: icon('ungroup'),
  group: 'structure',
  defaultBinding: [{ spec: { kind: 'key', key: 'g', mods: { mod: true, shift: true }, phase: BETWEEN_GESTURES }, opts: { id: 'ungroup.key' } }],
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const scene = deps.scene;
      if (!deps.selection || !scene) return;
      const plan = ungroupPlan(scene, selectedContent(deps));
      if (!plan || plan.locked) return;
      commitOps(deps, ungroupOps(scene, plan), 'Ungroup', { select: plan.freed });
    },
  },
  enabled: (deps) => {
    const plan = ungroupPlan(deps?.scene, selectedContent(deps));
    if (!plan) return ActionDisabledReason.NotApplicable;
    return plan.locked ? ActionDisabledReason.Locked : true;
  },
};
