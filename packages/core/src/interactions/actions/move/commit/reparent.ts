import { createReparentOp } from 'core/ops/reparent';
import { createSetLayerOp } from 'core/ops/setLayer';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { planeToPlane } from 'core/viewport/parallax';
import { rebaseLocalPose } from 'core/scene/composePose';
import { scenePoseAdapter } from 'core/scene/scenePoseAdapter';
import { carryPose, planeOf } from '../../planeInput';
import { draggedWorldPose, grabbedPoseAdapter } from '../delta';
import type { MoveSession, ReparentOnDrop } from '../session';
import { translateOps } from '../translate';

/** Resolved drop target — the new parent + layer + (for `'above'` mode)
 *  the hit sibling whose z-order position the moved node should land
 *  immediately above. `newParent === null` means "land at the layer
 *  root" (top-level node of `newLayer`). */
export interface DropTarget {
  newParent: NodeId | null;
  newLayer: string;
  hitSibling: NodeId | null;
}

/** Walk the hit chain to find the appropriate drop target. Returns
 *  `null` when no reparent should happen (drop on empty canvas, or the
 *  only hits are the moved subtree itself). */
export function resolveDropTarget(
  session: MoveSession,
  at: { x: number; y: number },
): DropTarget | null {
  const dep = session.nodeAtPoint;
  if (!dep) return null;

  // Exclude moved roots + their descendants. Otherwise we'd happily
  // reparent a node into itself (or under one of its own children).
  const exclude = new Set<NodeId>([...session.ids, ...session.cascadeIds]);
  const hit = dep(at, exclude);
  if (!hit) return null;

  const hitNode = session.scene.get(hit);
  if (!hitNode) return null;

  // Containers act as drop-INTO targets; leaves act as drop-NEXT-TO
  // targets (parent = leaf's parent). When the leaf has no parent
  // (top-level under a layer), `newParent === null` and the moved
  // subtree lands at the layer root.
  if (hitNode.kind === 'group' && session.admits(hit)) {
    return { newParent: hit, newLayer: hitNode.layer, hitSibling: null };
  }
  // A container `canDropInto` refuses is a sibling to land beside, inside
  // the nearest container around it that admits the drop.
  let newParent = hitNode.parent;
  let hitSibling: NodeId = hit;
  while (newParent !== null && !session.admits(newParent)) {
    hitSibling = newParent;
    newParent = session.scene.get(newParent)?.parent ?? null;
  }
  return { newParent, newLayer: hitNode.layer, hitSibling };
}

/** Reparent and reposition each moved root as ops, keeping the world pose the
 *  drag showed, then the ops that bring uncarried descendants along. */
export function reparentOps(
  session: MoveSession,
  target: DropTarget,
  mode: ReparentOnDrop,
  delta: { dx: number; dy: number },
): Op[] {
  const { scene, pc, view } = session;
  const adapter = scenePoseAdapter(scene);
  const label = session.lifecycle.label;
  const ops: Op[] = [];
  // The destination's children as each op will find them: an earlier root's
  // landing shifts where a later one goes.
  const siblings = [...(target.newParent === null ? scene.roots : scene.childrenOf(target.newParent))];
  for (const id of session.ids) {
    if (!session.startPoses.has(id)) continue;
    const node = scene.get(id)!;
    const crossing = node.layer !== target.newLayer;
    const world = carryPose(
      session.descriptorOf(id),
      draggedWorldPose(session, grabbedPoseAdapter(session, adapter), id, delta),
      crossing ? planeToPlane(planeOf(view, node.layer), planeOf(view, target.newLayer)) : null,
    );
    const to = rebaseLocalPose(adapter, world, target.newParent as string | null, pc.compose, pc.decompose);

    let from = node.parent as string | null;
    if (crossing) {
      // The scene refuses a layer change on a node whose parent is on another layer.
      if (from !== null) {
        ops.push(createReparentOp({
          id: id as string, fromParentId: from, toParentId: null, label, coalesceKey: `reparent:${id}:orphan`,
        }));
        from = null;
      }
      ops.push(createSetLayerOp({ id: id as string, from: node.layer, to: target.newLayer, label }));
    }

    const was = siblings.indexOf(id);
    if (was >= 0) siblings.splice(was, 1);
    const hit = mode === 'above' && target.hitSibling
      ? siblings.indexOf(target.hitSibling)
      : -1;
    const toIndex = hit >= 0 ? hit + 1 : undefined;
    if (toIndex === undefined) siblings.push(id);
    else siblings.splice(toIndex, 0, id);

    ops.push(createReparentOp({
      id: id as string, fromParentId: from, toParentId: target.newParent as string | null, toIndex, label,
    }));
    ops.push(createTransformOp<unknown>({ id: id as string, from: node.pose, to, label }));
  }
  return [...ops, ...translateOps(session, session.cascadeIds, delta)];
}
