import { createReparentOp } from 'core/ops/reparent';
import { createSetLayerOp } from 'core/ops/setLayer';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { isPageStructure } from 'core/scene/nodeGates';
import { pageOfNode } from 'core/pages/pageNodes';
import { followerMoveOps, followerMoves } from '../../followerMoves';
import { planeToPlane } from 'core/viewport/parallax';
import { rebaseLocalPose } from 'core/scene/composePose';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import { carryPose, planeOf } from '../../planeInput';
import { draggedWorldPose, grabbedPoseAdapter } from '../delta';
import type { MoveSession, ReparentOnDrop } from '../session';
import { translateOps } from '../translate';
import { translateNodeOps } from '../../moveNodes';
import { outermost } from '@weasel-js/select';
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

/** The ops for `ids`, descendants of a root moved into `newParent`: each one stored in the frame it is
 *  moved into, on `newLayer` when given, at the world place the drag `delta` gives. One a moving frame
 *  carries keeps only what it caught mid-glide, as in a translate. */
export function landedCascadeOps(
  session: MoveSession,
  ids: readonly NodeId[],
  newParent: NodeId | null,
  delta: { dx: number; dy: number },
  newLayer?: string,
): Op[] {
  const own = new Map<NodeId, { dx: number; dy: number }>();
  for (const id of ids) {
    const start = session.startPoses.get(id);
    if (start === undefined || session.carried.has(id) || !session.scene.get(id)) continue;
    const d = session.descriptorOf(id);
    const from = d.getBounds(start);
    const to = d.getBounds(landedLocalPose(session, id, newParent, newLayer ?? session.scene.get(id)!.layer, delta));
    const c = session.caught.get(id) ?? { dx: 0, dy: 0 };
    own.set(id, { dx: to.x - from.x + c.dx, dy: to.y - from.y + c.dy });
  }
  return [
    ...translateOps(session, ids.filter((id) => session.carried.has(id)), delta),
    ...translateNodeOps(
      session.scene, own.keys(), (id) => own.get(id) ?? null, session.descriptorOf, session.geometryProjection,
      session.lifecycle.label,
    ),
  ];
}

/** The ops that move root `id` into `to` at `toIndex`, onto `layer` first when it is on another. */
export function landOps(
  session: MoveSession,
  id: NodeId,
  to: NodeId | null,
  toIndex: number | undefined,
  layer: string,
): Op[] {
  const node = session.scene.get(id)!;
  const label = session.lifecycle.label;
  const ops: Op[] = [];
  let from = node.parent as string | null;
  if (node.layer !== layer) {
    // The scene refuses a layer change on a node whose parent is on another layer.
    if (from !== null) {
      ops.push(createReparentOp({
        id: id as string, fromParentId: from, toParentId: null, label, coalesceKey: `reparent:${id}:orphan`,
      }));
      from = null;
    }
    ops.push(createSetLayerOp({ id: id as string, from: node.layer, to: layer, label }));
  }
  ops.push(createReparentOp({ id: id as string, fromParentId: from, toParentId: to as string | null, toIndex, label }));
  return ops;
}

/** Reparent and reposition each moved root as ops, keeping the world pose the
 *  drag showed, then the ops that bring uncarried descendants along, and the
 *  followers whose page that changes (`followerMoves`). */
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
  const roots = new Set(outermost(session.ids, (id) => scene.get(id)?.parent ?? null));
  for (const id of roots) {
    const node = scene.get(id);
    // A node removed mid-drag is skipped, as the translate commit skips it.
    if (!session.startPoses.has(id) || node === undefined) continue;
    const to = landedLocalPose(session, id, target.newParent, target.newLayer, delta);
    const toIndex = landAbove(siblings, id, mode === 'above' ? target.hitSibling : null);
    ops.push(...landOps(session, id, target.newParent, toIndex, target.newLayer));
    ops.push(createTransformOp<unknown>({ id: id as string, from: node.pose, to, label }));
  }
  const riders = [...new Set([...session.ids.filter((id) => !roots.has(id)), ...session.cascadeIds])];
  const page = target.newParent === null ? null : pageOfNode(scene, target.newParent);
  const landed = new Map([...roots].filter((id) => session.startPoses.has(id) && scene.get(id) !== undefined)
    .map((id) => [id as string, page]));
  return [
    ...ops,
    ...landedCascadeOps(session, riders, target.newParent, delta, target.newLayer),
    ...followerMoveOps(followerMoves(scene, landed), label),
  ];
}
