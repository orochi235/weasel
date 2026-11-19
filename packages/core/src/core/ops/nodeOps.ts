/** Inserting and deleting a whole node at its slot among its siblings: what a command that replaces a node with
 *  new ones writes. */
import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Op } from './types';
import { createInsertOp } from './create';
import { createDeleteOp } from './delete';

/** Where `id` sits among its siblings, back to front. */
export function slotOf(scene: Scene<unknown, string, unknown>, id: NodeId): number {
  const parent = scene.get(id)?.parent ?? null;
  const siblings = parent === null ? scene.roots : scene.childrenOf(parent);
  return siblings.indexOf(id);
}

/** Insert `node` at `index` among its parent's children. */
export function createInsertNodeOp(node: Node<unknown, string, unknown>, index: number, label: string): Op {
  return createInsertOp(index >= 0 ? { node, index, label } : { node, label });
}

/** Delete `node`, remembering its slot for undo. */
export function createDeleteNodeOp(scene: Scene<unknown, string, unknown>, node: Node<unknown, string, unknown>, label: string): Op {
  return createDeleteOp({ node, index: slotOf(scene, node.id), label });
}
