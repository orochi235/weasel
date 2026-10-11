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
import { documentPose } from 'core/scene/effectivePose';
import { fnFieldsOfNode } from 'core/scene/nodeFnFields';
import { pickability } from 'core/scene/pickability';
import type { Op } from 'core/ops/types';
import type { Node, PoseOverride, Scene } from 'core/scene/types';
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
  previewPoses(poses: ReadonlyMap<string, TPose | null>): void;
};

/** `commit` is how a behavior's own `applyOps` batch lands; the returned
 *  adapter is passed back so the ops apply through it. Left out, the adapter
 *  has no `applyOps`. */
export function moveGestureAdapter<TPose>(
  scene: Scene<unknown, string, TPose>,
  commit?: (ops: Op[], label: string, adapter: MoveGestureAdapter<TPose>) => void,
): MoveGestureAdapter<TPose> {
  const previews = new Map<string, PoseOverride<TPose>>();
  const adapter: MoveGestureAdapter<TPose> = {
    ...(commit ? { applyOps: (ops: Op[], label: string) => commit(ops, label, adapter) } : {}),
    previewPoses: (poses) => {
      const { overrides } = scene;
      for (const [id, pose] of poses) {
        const nodeId = asNodeId(id);
        const mine = previews.get(id);
        const installed = mine !== undefined && overrides.get(nodeId) === mine;
        if (pose === null) {
          previews.delete(id);
          if (installed) overrides.clear(nodeId);
        } else if (installed) {
          mine.pose = pose;
        } else {
          const entry = { pose };
          previews.set(id, entry);
          overrides.set(nodeId, entry);
        }
      }
      overrides.commit();
    },
    getNode: (id) => scene.get(asNodeId(id)),
    getNodes: () => {
      return [...scene.renderOrderNodes()] as Node<unknown, string, TPose>[];
    },
    getPose: (id) => documentPose(scene, scene.get(asNodeId(id))!),
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
        ...(node.dependsOn !== undefined ? { dependsOn: node.dependsOn } : {}),
        ...pickability(node),
        ...fnFieldsOfNode(node),
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
  return adapter;
}
