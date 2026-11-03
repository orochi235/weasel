import { createReparentOp } from 'core/ops/reparent';
import { createSetLayerOp } from 'core/ops/setLayer';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { isPageStructure } from 'core/scene/nodeGates';
import { planeToPlane } from 'core/viewport/parallax';
import { rebaseLocalPose } from 'core/scene/composePose';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import { carryPose, planeOf } from '../../planeInput';
import { draggedWorldPose, grabbedPoseAdapter } from '../delta';
import type { MoveSession, ReparentOnDrop } from '../session';
import { translateOps } from '../translate';
import { refusalOf } from '../../dropVerdict';
import { worldBoundsOf, type MoveRefusal } from '../refusal';

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
 *  `null` when no reparent should happen (drop on empty canvas, the
 *  only hits are the moved subtree itself, or a page or the run refuses
 *  it, since the climb never passes page structure), and a refusal when the first
 *  node of the chain to answer refuses with a reason. */
export function resolveDrop(
  session: MoveSession,
  at: { x: number; y: number },
): DropTarget | { refused: MoveRefusal } | null {
  const dep = session.nodeAtPoint;
  if (!dep) return null;

  // Exclude moved roots + their descendants. Otherwise we'd happily
  // reparent a node into itself (or under one of its own children).
  const exclude = new Set<NodeId>([...session.ids, ...session.cascadeIds]);
  const hit = dep(at, exclude);
  if (!hit) return null;

  const hitNode = session.scene.get(hit);
  if (!hitNode) return null;

  // A node that admits the drop is a drop-INTO target; one that refuses it
  // silently is a sibling to land beside, inside the nearest ancestor that
  // admits it. When there is none, `newParent === null` and the moved subtree
  // lands at the layer root.
  let newParent: NodeId | null = hit;
  let hitSibling: NodeId | null = null;
  while (newParent !== null) {
    const verdict = session.verdict(newParent);
    if (verdict === true) break;
    const reason = refusalOf(verdict);
    if (reason !== null) return { refused: { id: newParent, bounds: worldBoundsOf(session, newParent), reason } };
    if (isPageStructure(session.scene.get(newParent))) return null;
    hitSibling = newParent;
    newParent = session.scene.get(newParent)?.parent ?? null;
  }
  return { newParent, newLayer: hitNode.layer, hitSibling };
}

/** Move `id` within `siblings`, a destination's children as the next op will find them, to just above
 *  `above` when it is among them, else to the end. Returns the index to reparent `id` to, or `undefined` to
 *  append. */
export function landAbove(siblings: NodeId[], id: NodeId, above: NodeId | null): number | undefined {
  const was = siblings.indexOf(id);
  if (was >= 0) siblings.splice(was, 1);
  const hit = above === null ? -1 : siblings.indexOf(above);
  const toIndex = hit >= 0 ? hit + 1 : undefined;
  if (toIndex === undefined) siblings.push(id);
  else siblings.splice(toIndex, 0, id);
  return toIndex;
}

/** Root `id`'s pose stored under `newParent` on `newLayer`, keeping the world pose the drag `delta` shows. */
export function landedLocalPose(
  session: MoveSession,
  id: NodeId,
  newParent: NodeId | null,
  newLayer: string,
  delta: { dx: number; dy: number },
): unknown {
  const { scene, pc, view } = session;
  const adapter = sceneViewPoseAdapter(scene);
  const layer = scene.get(id)!.layer;
  const world = carryPose(
    session.descriptorOf(id),
    draggedWorldPose(session, grabbedPoseAdapter(session, adapter), id, delta),
    layer !== newLayer ? planeToPlane(planeOf(view, layer), planeOf(view, newLayer)) : null,
  );
  return rebaseLocalPose(adapter, world, newParent as string | null, pc.compose, pc.decompose);
}

/** Reparent and reposition each moved root as ops, keeping the world pose the
 *  drag showed, then the ops that bring uncarried descendants along. */
export function reparentOps(
  session: MoveSession,
  target: DropTarget,
  mode: ReparentOnDrop,
  delta: { dx: number; dy: number },
): Op[] {
  const { scene } = session;
  const label = session.lifecycle.label;
  const ops: Op[] = [];
  // The destination's children as each op will find them: an earlier root's
  // landing shifts where a later one goes.
  const siblings = [...(target.newParent === null ? scene.roots : scene.childrenOf(target.newParent))];
  for (const id of session.ids) {
    if (!session.startPoses.has(id)) continue;
    const node = scene.get(id)!;
    const crossing = node.layer !== target.newLayer;
    const to = landedLocalPose(session, id, target.newParent, target.newLayer, delta);

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

    const toIndex = landAbove(siblings, id, mode === 'above' ? target.hitSibling : null);

    ops.push(createReparentOp({
      id: id as string, fromParentId: from, toParentId: target.newParent as string | null, toIndex, label,
    }));
    ops.push(createTransformOp<unknown>({ id: id as string, from: node.pose, to, label }));
  }
  return [...ops, ...translateOps(session, session.cascadeIds, delta)];
}
