import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import { freshNodeId } from './freshNodeId';
import { selectedRoots } from '../selectionSubtree';

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
): NodeId | null {
  const node = scene.get(id);
  if (!node) return null;
  const newId = freshNodeId();
  const copy = { ...node, id: newId, pose: poseOf(id, node, isRoot), parent } as AnyNode;
  ops.push(createInsertOp<AnyNode>({ node: copy, label }));
  for (const child of scene.childrenOf(id)) {
    copySubtree(scene, child, newId, false, poseOf, label, ops);
  }
  return newId;
}

/**
 * Insert ops copying each of `ids` with its whole subtree, so copying a group
 * produces a populated group. Ops are in pre-order: a parent is inserted
 * before its children. A copied root keeps its source's parent.
 */
export function copySelection(
  scene: AnyScene,
  ids: readonly string[],
  poseOf: CopyPose,
  label: string,
): { ops: Op[]; copies: NodeId[] } {
  const ops: Op[] = [];
  const copies: NodeId[] = [];
  for (const id of selectedRoots(scene, ids)) {
    const newId = copySubtree(scene, id, scene.get(id)?.parent ?? null, true, poseOf, label, ops);
    if (newId) copies.push(newId);
  }
  return { ops, copies };
}
