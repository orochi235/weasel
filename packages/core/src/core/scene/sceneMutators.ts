/**
 * What every scene-backed adapter shares: the writes an op applies through,
 * and the structural reads those ops need. `sceneToAdapter`,
 * `defaultCommitAdapter`, and `moveGestureAdapter` all build on it.
 *
 * It leaves out the pose and node-list reads, where the adapters differ on
 * purpose. The canvas adapter answers with what is shown: the effective pose,
 * visible layers only. An adapter ops commit through answers with what the
 * document holds, which is {@link documentReads}.
 */
import type { LayoutStrategy } from '../../layout/types';
import { documentPose } from './effectivePose';
import { fnFieldsOfNode } from './nodeFnFields';
import { statedFields } from './statedFields';
import { asNodeId, type Node, type Scene } from './types';

export interface SceneMutators<TData, TLayer extends string, TPose> {
  getNode(id: string): Node<TData, TLayer, TPose> | undefined;
  getParent(id: string): string | null;
  /** Ordered children of `parentId`; `null` names the root siblings. */
  getChildren(parentId: string | null): string[];
  /** Every id removing `ids` takes: their subtrees and their dependents. */
  getRemovalClosure(ids: readonly string[]): string[];
  setPose(id: string, pose: TPose): void;
  setParent(id: string, parentId: string | null): void;
  /** One undo step when called bare; inside a batch it joins that batch. */
  setChildOrder(parentId: string | null, ids: string[]): void;
  setData(id: string, data: TData): void;
  setLayer(id: string, layer: TLayer): void;
  /** What a `setDependsOn` op writes through. */
  setDependsOn(id: string, dependsOn: readonly string[] | 'children' | undefined): void;
  setLayout(id: string, layout: LayoutStrategy<TPose> | string | null): void;
  /** What a `setHidden` op writes through. */
  setHidden(id: string, hidden: boolean): void;
  /** What a `setLocked` op writes through. */
  setLocked(id: string, locked: boolean): void;
  removeNode(id: string): void;
  /** Re-add `node` as it was, at sibling `index` when one is given. */
  insertNode(node: Node<TData, TLayer, TPose>, index?: number): void;
}

export function sceneMutators<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): SceneMutators<TData, TLayer, TPose> {
  const getChildren = (parentId: string | null): string[] =>
    (parentId === null ? [...scene.roots] : [...scene.childrenOf(asNodeId(parentId))]);
  return {
    getNode: (id) => scene.get(asNodeId(id)),
    getParent: (id) => scene.get(asNodeId(id))?.parent ?? null,
    getChildren,
    getRemovalClosure: (ids) => [...scene.removalClosure(ids.map(asNodeId))],
    setPose: (id, pose) => scene.setPose(asNodeId(id), pose),
    setParent: (id, parentId) => scene.move(asNodeId(id), parentId == null ? null : asNodeId(parentId)),
    setChildOrder: (parentId, ids) => {
      scene.batch('Reorder', () => {
        for (let i = 0; i < ids.length; i++) {
          // Re-read each time: a reorder shifts later ids, sometimes into place.
          if (getChildren(parentId)[i] === ids[i]) continue;
          scene.reorder(asNodeId(ids[i]), i);
        }
      });
    },
    setData: (id, data) => scene.update(asNodeId(id), { data }),
    setLayer: (id, layer) => scene.setLayer(asNodeId(id), layer),
    setDependsOn: (id, dependsOn) =>
      scene.setDependsOn(asNodeId(id), Array.isArray(dependsOn) ? dependsOn.map(asNodeId) : dependsOn as 'children' | undefined),
    setLayout: (id, layout) => scene.setLayout(asNodeId(id), layout),
    setHidden: (id, hidden) => scene.setHidden(asNodeId(id), hidden),
    setLocked: (id, locked) => scene.setLocked(asNodeId(id), locked),
    removeNode: (id) => scene.remove(asNodeId(id)),
    insertNode: (node, index) => {
      scene.add({
        kind: node.kind,
        layer: node.layer,
        pose: node.pose,
        data: node.data,
        id: node.id,
        ...(index !== undefined ? { index } : {}),
        ...(node.parent != null ? { parent: node.parent } : {}),
        // Derivation travels with the node, or undo of a delete brings an
        // edge back as a static path that never follows its endpoints again.
        ...(node.dependsOn !== undefined ? { dependsOn: node.dependsOn } : {}),
        ...statedFields(node),
        ...fnFieldsOfNode(node),
      });
    },
  };
}

/** The pose and node-list reads of an adapter ops commit through: the document,
 *  whatever a gesture is showing and whichever layers are hidden. */
export function documentReads<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): { getPose(id: string): TPose; getNodes(): Node<TData, TLayer, TPose>[] } {
  return {
    getPose: (id) => documentPose(scene, scene.get(asNodeId(id))!),
    getNodes: () => [...scene.renderOrderNodes()],
  };
}
