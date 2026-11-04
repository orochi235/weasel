import type { BooleanShapeOp } from 'core/geometry/booleanOfPaths';
import { booleanGroupFields } from 'core/scene/booleanGroup';
import { withoutPageStructure } from 'core/scene/nodeGates';
import { groupingSite } from 'core/pages/pagePlacement';
import { pageOfNode } from 'core/pages/pageNodes';
import { followerMoves } from '../followerMoves';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { unionBounds } from 'core/geometry/unionBounds';
import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Action } from '@weasel-js/routing';
import { requiresContent } from '../defaults/requiresSelection';
import { scenePoseFrame } from '../poseFrame';
import { icon } from '../../../icons.gen';

type AnyScene = Scene<unknown, string, unknown>;

const PAINT_KEYS = ['fill', 'stroke'] as const;

/**
 * Put `ids` under a new boolean group of `op`, in the frontmost one's place
 * in the container `groupingSite` names, as one undo entry; nothing moves on
 * screen, unless the operands lie wholly off every page with the pasteboard
 * off and move onto one, and a node following one that changes page goes
 * where `followerMoves` says. The group wears the frontmost
 * operand's `fill` and `stroke`. Returns its id, or `null` when fewer than two
 * of `ids` are nodes on one layer.
 */
export function makeBooleanGroup(scene: AnyScene, ids: readonly string[], op: BooleanShapeOp = 'union'): NodeId | null {
  const order = new Map([...scene.renderOrder()].map((id, i) => [id as string, i]));
  const nodes = ids
    .map((id) => scene.get(id as NodeId))
    .filter((n): n is Node<unknown, string, unknown> => n !== undefined)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  if (nodes.length < 2 || new Set(nodes.map((n) => n.layer)).size > 1) return null;
  const front = nodes.at(-1)!;
  const frame = scenePoseFrame(scene);
  const worlds = new Map(nodes.map((n) => [n.id, frame.world(n.id)]));
  const { translate, getBounds } = AUTO_POSE_DESCRIPTOR;
  const { parent, shift } = groupingSite(scene, nodes.map((n) => n.id), unionBounds([...worlds.values()].map(getBounds)));
  if (shift.dx !== 0 || shift.dy !== 0) for (const [id, p] of worlds) worlds.set(id, translate!(p, shift.dx, shift.dy));
  const siblings = parent === null ? scene.roots : scene.childrenOf(parent);
  const at = siblings.indexOf(front.id);
  const own = (front.data ?? {}) as Record<string, unknown>;
  const data = { boolean: op, ...Object.fromEntries(PAINT_KEYS.filter((k) => k in own).map((k) => [k, own[k]])) };
  const page = parent === null ? null : pageOfNode(scene, parent);
  const followers = followerMoves(scene, new Map(nodes.map((n) => [n.id as string, page])));
  let group: NodeId | null = null;
  scene.batch('Make Boolean Group', () => {
    group = scene.add({
      ...booleanGroupFields(), layer: front.layer, pose: front.pose, data, parent,
      ...(at >= 0 ? { index: at + 1 } : {}),
    });
    nodes.forEach((n, i) => {
      scene.move(n.id, group, i);
      scene.setPose(n.id, frame.localUnder(group, worlds.get(n.id)!) as never);
    });
    for (const f of followers) {
      scene.move(f.id, f.into);
      scene.setPose(f.id, f.to);
    }
  });
  return group;
}

/** Put the selection under a new boolean group, a union until its operation is changed. */
export const makeBooleanGroupAction: Action & { requires: string[] } = {
  id: 'pathfinder.booleanGroup',
  label: 'Make Boolean Group',
  icon: icon('booleanGroup'),
  group: 'pathfinder',
  eligible: { capability: 'creates-shapes' },
  requires: ['scene', 'selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const { scene, selection } = deps;
      if (!scene || !selection) return;
      const id = makeBooleanGroup(scene as AnyScene, withoutPageStructure(scene, selection.get()));
      if (id !== null) selection.set([id]);
    },
  },
  enabled: requiresContent(2),
};
