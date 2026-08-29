/**
 * Minimal scene-backed adapter for the move behavior pipeline.
 *
 * Lives in `interactions/` rather than reusing `canvas/sceneAdapter.ts` so the
 * move action does not import from `canvas/` (that back-edge would create an
 * `interactions → canvas → interactions` cycle). Carries exactly the methods
 * the move behaviors call (`getParent` / `getNodes` / `getNode`) plus the
 * mutators the committed ops apply through (`setPose` / `setParent` /
 * `setData` / `removeNode` / `insertNode` — `setData` carries the
 * geometryProjection seam's data-sync op) and the sibling-order seam
 * (`getChildren` / `setChildOrder`) those ops read to restore a node's slot.
 */
import type { Node, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { MoveAdapter } from 'core/adapters/types';

export type MoveGestureAdapter<TPose> = MoveAdapter<Node<unknown, string, TPose>, TPose> & {
  /** Required override — this adapter always provides parent lookup. */
  getParent(id: string): string | null;
  setParent(id: string, parentId: string | null): void;
  setData(id: string, data: unknown): void;
  removeNode(id: string): void;
  insertNode(node: Node<unknown, string, TPose>, index?: number): void;
  getChildren(parentId: string | null): string[];
  setChildOrder(parentId: string | null, ids: string[]): void;
};

export function moveGestureAdapter<TPose>(
  scene: Scene<unknown, string, TPose>,
): MoveGestureAdapter<TPose> {
  return {
    getNode: (id) => scene.get(asNodeId(id)),
    getNodes: () => {
      return [...scene.renderOrderNodes()] as Node<unknown, string, TPose>[];
    },
    getPose: (id) => scene.get(asNodeId(id))!.pose,
    getParent: (id) => scene.get(asNodeId(id))?.parent ?? null,
    setPose: (id, pose) => scene.setPose(asNodeId(id), pose),
    setParent: (id, parentId) =>
      scene.move(asNodeId(id), parentId === null ? null : asNodeId(parentId)),
    setData: (id, data) => scene.update(asNodeId(id), { data } as never),
    removeNode: (id) => scene.remove(asNodeId(id)),
    insertNode: (node, index) =>
      scene.add({
        kind: node.kind,
        layer: node.layer,
        pose: node.pose,
        data: node.data,
        id: node.id,
        ...(index !== undefined ? { index } : {}),
        ...(node.parent !== null ? { parent: node.parent } : {}),
      }),
    getChildren: (parentId) =>
      parentId === null ? [...scene.roots] : [...scene.childrenOf(asNodeId(parentId))],
    setChildOrder: (parentId, ids) => {
      scene.batch('Reorder', () => {
        for (let i = 0; i < ids.length; i++) {
          const current = parentId === null ? scene.roots : scene.childrenOf(asNodeId(parentId));
          if (current[i] === ids[i]) continue;
          scene.reorder(asNodeId(ids[i]), i);
        }
      });
    },
  };
}
