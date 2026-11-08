import type { BooleanShapeOp } from 'core/geometry/booleanOfPaths';
import { booleanGroupFields } from 'core/scene/booleanGroup';
import { withoutPageStructure } from 'core/scene/nodeGates';
import { groupingSite } from 'core/pages/pagePlacement';
import { pageOfNode } from 'core/pages/pageNodes';
import { followerMoveOps, followerMoves } from '../followerMoves';
import { commitOps, defaultCommitAdapter } from '../defaultCommitAdapter';
import { createInsertOp } from 'core/ops/create';
import { createReparentOp } from 'core/ops/reparent';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { unionBounds } from 'core/geometry/unionBounds';
import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Action } from '@weasel-js/routing';
import { requiresContent } from '../defaults/requiresSelection';
import { scenePoseFrame } from '../poseFrame';
import { inPaintOrder, slotAbove } from '../groupSlot';
import { icon } from '../../../icons.gen';

type AnyScene = Scene<unknown, string, unknown>;

const PAINT_KEYS = ['fill', 'stroke'] as const;

/**
 * The ops that put `ids` under a new boolean group of `op`, in the frontmost one's place
 * in the container `groupingSite` names, labeled `label`; nothing moves on
 * screen, unless the operands lie wholly off every page with the pasteboard
 * off and move onto one, and a node following one that changes page goes
 * where `followerMoves` says. The group wears the frontmost
 * operand's `fill` and `stroke`. Null when fewer than two
 * of `ids` are nodes on one layer.
 */
export function booleanGroupOps(
  scene: AnyScene,
  ids: readonly string[],
  op: BooleanShapeOp = 'union',
  label = 'Make Boolean Group',
): { ops: Op[]; group: NodeId } | null {
  const nodes = inPaintOrder(scene, ids
    .map((id) => scene.get(id as NodeId))
    .filter((n): n is Node<unknown, string, unknown> => n !== undefined));
  if (nodes.length < 2 || new Set(nodes.map((n) => n.layer)).size > 1) return null;
  const front = nodes.at(-1)!;
  const frame = scenePoseFrame(scene);
  const worlds = new Map(nodes.map((n) => [n.id, frame.world(n.id)]));
  const { translate, getBounds } = AUTO_POSE_DESCRIPTOR;
  const { parent, shift } = groupingSite(scene, nodes.map((n) => n.id), unionBounds([...worlds.values()].map(getBounds)));
  if (shift.dx !== 0 || shift.dy !== 0) for (const [id, p] of worlds) worlds.set(id, translate!(p, shift.dx, shift.dy));
  const index = slotAbove(scene, parent, front.id);
  const own = (front.data ?? {}) as Record<string, unknown>;
  const data = { boolean: op, ...Object.fromEntries(PAINT_KEYS.filter((k) => k in own).map((k) => [k, own[k]])) };
  const page = parent === null ? null : pageOfNode(scene, parent);
  const followers = followerMoves(scene, new Map(nodes.map((n) => [n.id as string, page])));
  const group = scene.mintId();
  const ops: Op[] = [
    createInsertOp({
      node: { ...booleanGroupFields(), id: group, layer: front.layer, pose: front.pose, data, parent } as Node<unknown, string, unknown>,
      ...(index !== undefined ? { index } : {}),
      label,
    }),
  ];
  nodes.forEach((n, i) => {
    ops.push(createReparentOp({ id: n.id, fromParentId: n.parent ?? null, toParentId: group, toIndex: i, label }));
    // The group derives its pose from its members, so it is no frame: they keep the frame it sits in.
    ops.push(createTransformOp<unknown>({ id: n.id, from: n.pose, to: frame.localUnder(parent, worlds.get(n.id)!), label }));
  });
  ops.push(...followerMoveOps(followers, label));
  return { ops, group };
}

/** {@link booleanGroupOps} committed straight to `scene` as one undo entry. Returns the group's id, or null. */
export function makeBooleanGroup(scene: AnyScene, ids: readonly string[], op: BooleanShapeOp = 'union'): NodeId | null {
  const made = booleanGroupOps(scene, ids, op);
  if (!made) return null;
  scene.applyBatch(made.ops, 'Make Boolean Group', defaultCommitAdapter(scene));
  return made.group;
}

/** Put the selection under a new boolean group, a union until its operation is changed. */
export const makeBooleanGroupAction: Action & { requires: string[] } = {
  id: 'pathfinder.booleanGroup',
  label: 'Make Boolean Group',
  icon: icon('booleanGroup'),
  group: 'pathfinder',
  eligible: { capability: 'creates-shapes' },
  requires: ['scene', 'selection', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const { scene, selection } = deps;
      if (!scene || !selection) return;
      const made = booleanGroupOps(scene as AnyScene, withoutPageStructure(scene, selection.get()));
      if (made) commitOps(deps, made.ops, 'Make Boolean Group', { select: [made.group] });
    },
  },
  enabled: requiresContent(2),
};
