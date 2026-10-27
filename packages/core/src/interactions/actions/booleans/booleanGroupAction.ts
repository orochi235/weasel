import type { BooleanShapeOp } from 'core/geometry/booleanOfPaths';
import { booleanGroupFields } from 'core/scene/booleanGroup';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { ActionDisabledReason, type Action } from '@weasel-js/routing';
import { scenePoseFrame } from '../poseFrame';
import { icon } from '../../../icons.gen';

type AnyScene = Scene<unknown, string, unknown>;

const PAINT_KEYS = ['fill', 'stroke'] as const;

/**
 * Put `ids` under a new boolean group of `op`, in the frontmost one's place, as
 * one undo entry; nothing moves on screen. The group wears the frontmost
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
  const parents = new Set(nodes.map((n) => n.parent ?? null));
  const parent = parents.size === 1 ? front.parent ?? null : null;
  const siblings = parent === null ? scene.roots : scene.childrenOf(parent);
  const at = siblings.indexOf(front.id);
  const own = (front.data ?? {}) as Record<string, unknown>;
  const data = { boolean: op, ...Object.fromEntries(PAINT_KEYS.filter((k) => k in own).map((k) => [k, own[k]])) };
  const frame = scenePoseFrame(scene);
  let group: NodeId | null = null;
  scene.batch('Make Boolean Group', () => {
    const worlds = new Map(nodes.map((n) => [n.id, frame.world(n.id)]));
    group = scene.add({
      ...booleanGroupFields(), layer: front.layer, pose: front.pose, data, parent,
      ...(at >= 0 ? { index: at + 1 } : {}),
    });
    nodes.forEach((n, i) => {
      scene.move(n.id, group, i);
      scene.setPose(n.id, frame.localUnder(group, worlds.get(n.id)!) as never);
    });
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
      const id = makeBooleanGroup(scene as AnyScene, selection.get());
      if (id !== null) selection.set([id]);
    },
  },
  enabled: (deps) => ((deps?.selection?.get().length ?? 0) >= 2 ? true : ActionDisabledReason.SelectionRequired),
};
