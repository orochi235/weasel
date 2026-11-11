import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import { createSetLockedOp } from 'core/ops/nodeFlags';
import { copiedRoots } from '../selectionSubtree';

type AnyScene = Scene<unknown, string, unknown>;
type AnyNode = Node<unknown, string, unknown>;

/** The pose a copy of `node` is stored with. `isRoot` is true for a selected
 *  node and false for one copied because an ancestor was. */
export type CopyPose = (id: NodeId, node: AnyNode, isRoot: boolean) => unknown;

function copySubtree(
  scene: AnyScene,
  id: NodeId,
  parent: NodeId | null,
  isRoot: boolean,
  poseOf: CopyPose,
  label: string,
  ops: Op[],
  copyOf: Map<NodeId, NodeId>,
  relock: NodeId[],
): NodeId | null {
  const node = scene.get(id);
  if (!node) return null;
  const newId = scene.mintId();
  copyOf.set(id, newId);
  const copy = { ...node, id: newId, pose: poseOf(id, node, isRoot), parent } as AnyNode;
  // Locked once its children are in: the scene refuses an add under a locked node.
  if (copy.locked === true) {
    delete (copy as { locked?: boolean }).locked;
    relock.push(newId);
  }
  ops.push(createInsertOp<AnyNode>({ node: copy, label }));
  for (const child of scene.childrenOf(id)) {
    copySubtree(scene, child, newId, false, poseOf, label, ops, copyOf, relock);
  }
  return newId;
}

/**
 * Insert ops copying each of `ids` with its whole subtree, so copying a group
 * produces a populated group. Ops are in pre-order: a parent is inserted
 * before its children. A copied root goes under `rootParent`, or keeps its
 * source's parent when that is undefined.
 *
 * A copy that derives from an id list follows the copy of each node in the
 * list that was copied with it, and the original of each that was not: the
 * originals are still in the scene to follow.
 */
export function copySelection(
  scene: AnyScene,
  ids: readonly string[],
  poseOf: CopyPose,
  label: string,
  rootParent?: NodeId | null,
): { ops: Op[]; copies: NodeId[] } {
  const ops: Op[] = [];
  const copies: NodeId[] = [];
  const copyOf = new Map<NodeId, NodeId>();
  const relock: NodeId[] = [];
  for (const id of copiedRoots(scene, ids)) {
    const newId = copySubtree(scene, id, rootParent !== undefined ? rootParent : scene.get(id)?.parent ?? null, true, poseOf, label, ops, copyOf, relock);
    if (newId) copies.push(newId);
  }
  for (const op of ops) {
    const node = (op.args as { node: AnyNode }).node;
    const deps = node.dependsOn;
    if (!Array.isArray(deps) || !deps.some((dep) => copyOf.has(dep))) continue;
    (node as { dependsOn?: readonly NodeId[] }).dependsOn = deps.map((dep) => copyOf.get(dep) ?? dep);
  }
  for (const id of relock) ops.push(createSetLockedOp({ id, from: false, to: true, label }));
  return { ops, copies };
}
