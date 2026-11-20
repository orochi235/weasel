import type { ActionDeps } from '@weasel-js/routing';
import type { NodeId, Op, Scene } from '@weasel-js/core';
import {
  documentOf, followerOpsFor, isEnvelope, moveEachOps, nodeDescriptors, poseDescriptorOf, sameValue, scenePoseFrame,
  translatePoseViaDescriptor, type PoseFrame,
} from '@weasel-js/core';
import * as coreOps from '@weasel-js/core/ops';


/** Where a node sits: its parent, its layer, and the sibling it is just below (`null` when it is last). */
interface Place {
  parent: NodeId | null;
  layer: string;
  index: number;
  before: string | null;
}

function placeOf(scene: Scene<unknown, string, unknown>, id: NodeId): Place {
  const node = scene.get(id)!;
  const parent = node.parent ?? null;
  const siblings = parent === null ? scene.roots : scene.childrenOf(parent);
  const index = siblings.indexOf(id);
  return { parent, layer: node.layer, index, before: siblings[index + 1] ?? null };
}

/** The ops that put `id`, now at `from`, into `to`'s parent, layer and sibling slot. */
function landOps(id: NodeId, from: Place, to: Place, label: string): Op[] {
  const ops: Op[] = [];
  let parent = from.parent as string | null;
  if (from.layer !== to.layer) {
    // The scene refuses a layer change on a node whose parent is on another layer.
    if (parent !== null) {
      ops.push(coreOps.reparent({ id, fromParentId: parent, toParentId: null, label, coalesceKey: `reparent:${id}:orphan` }));
      parent = null;
    }
    ops.push(coreOps.setLayer({ id, from: from.layer, to: to.layer, label }));
  }
  ops.push(coreOps.reparent({
    id, fromParentId: parent, toParentId: to.parent, toSlot: { index: to.index, before: to.before }, label,
  }));
  return ops;
}

/**
 * The poses that keep `id`, translated to `world`, where it is once it is stored under `parent`: its own,
 * and through an envelope, which stores its children in its parent's frame, those of its children. `from` is
 * each pose as stored once the translation has applied. `null` when `parent`'s frame is singular.
 */
function reframed(
  scene: Scene<unknown, string, unknown>,
  frame: PoseFrame<unknown>,
  id: NodeId,
  parent: NodeId | null,
  worldOf: (id: NodeId) => unknown,
  from: (id: NodeId) => unknown,
  label: string,
): Op[] | null {
  const ops: Op[] = [];
  const keep = (at: NodeId): boolean => {
    const node = scene.get(at);
    if (node === undefined) return true;
    // A derived pose is not stored, so it has nothing to rewrite.
    if (node.derivePose === undefined) {
      const to = frame.localUnder(parent, worldOf(at));
      if (to === null) return false;
      const was = from(at);
      if (!sameValue(was, to)) ops.push(coreOps.setPose<unknown>({ id: at, from: was, to, label }));
    }
    return !isEnvelope(node) || scene.childrenOf(at).every(keep);
  };
  return keep(id) ? ops : null;
}

/**
 * The ops that make `a` and `b` trade places, for one undo step: each moves onto the other's bounds, carrying
 * what is inside it, and takes the other's parent, layer and place among its siblings. Poses are read from the
 * document, so a drag in flight over either one does not count as where it is. `null` when either would land
 * in a singular frame, or past the double range.
 *
 * This is the commit for the `swap` command and for a swap drop; whether the two may trade places is
 * `swappable`'s to say.
 */
export function swapOps(
  scene: Scene<unknown, string, unknown>,
  a: string,
  b: string,
  deps: Pick<ActionDeps, 'poseDescriptor' | 'geometryProjection'> = {},
  label = 'Swap',
): Op[] | null {
  const doc = documentOf(scene);
  const ia = a as NodeId;
  const ib = b as NodeId;
  if (doc.get(ia) === undefined || doc.get(ib) === undefined || a === b) return null;
  const frame = scenePoseFrame(doc);
  const descriptorOf = nodeDescriptors(doc, poseDescriptorOf(deps.poseDescriptor));
  const from = descriptorOf(ia).getBounds(frame.world(ia));
  const to = descriptorOf(ib).getBounds(frame.world(ib));
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const moved = moveEachOps(doc, [{ ids: [a], dx, dy }, { ids: [b], dx: -dx, dy: -dy }], deps, label);
  if (moved.length === 0 && (dx !== 0 || dy !== 0)) return null;
  const ops: Op[] = [...moved];

  const pa = placeOf(doc, ia);
  const pb = placeOf(doc, ib);
  if (pa.parent === pb.parent) {
    const siblings = [...(pa.parent === null ? doc.roots : doc.childrenOf(pa.parent))] as string[];
    siblings[pa.index] = b;
    siblings[pb.index] = a;
    ops.push(coreOps.setChildOrder({ orders: [{ parentId: pa.parent, ids: siblings }], label }));
    if (pa.layer !== pb.layer) {
      ops.push(coreOps.setLayer({ id: a, from: pa.layer, to: pb.layer, label }));
      ops.push(coreOps.setLayer({ id: b, from: pb.layer, to: pa.layer, label }));
    }
    return ops;
  }

  ops.push(...landOps(ia, pa, pb, label), ...landOps(ib, pb, pa, label));
  // Each node, and an envelope's children, keeps its new world place in its new parent's frame.
  const stored = new Map(moved.filter((op) => op.name === 'transform')
    .map((op) => [(op.args as { id: string }).id, (op.args as { to: unknown }).to]));
  const storedOf = (id: NodeId): unknown => (stored.has(id) ? stored.get(id) : doc.get(id)!.pose);
  const offsetOf = (root: NodeId) => (root === ia ? { dx, dy } : { dx: -dx, dy: -dy });
  for (const [root, parent] of [[ia, pb.parent], [ib, pa.parent]] as const) {
    const d = offsetOf(root);
    const worldOf = (id: NodeId) => translatePoseViaDescriptor(frame.world(id), d.dx, d.dy, descriptorOf(id));
    const kept = reframed(doc, frame, root, parent, worldOf, storedOf, label);
    if (kept === null) return null;
    ops.push(...kept);
  }
  const followers = followerOpsFor(doc, new Map([[a, pb.parent], [b, pa.parent]]), label);
  if (followers === null) return null;
  ops.push(...followers);
  return ops;
}
