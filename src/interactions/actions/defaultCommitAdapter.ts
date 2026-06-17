/**
 * Shared scene-backed commit adapter for default actions.
 *
 * Default actions route data/layer/pose/parent mutations through the
 * consumer's `applyOps` commit hook when one is present; when it isn't, they
 * fall back to applying the committed ops directly against the scene through
 * this adapter. It carries every op-apply method the built-in op factories
 * call (`setPose` / `setParent` / `setData` / `setLayer` / `removeNode` /
 * `insertNode`) plus the read-side queries (`getNode` / `getNodes` /
 * `getPose` / `getParent`).
 *
 * Lives in `interactions/actions/` (not `canvas/sceneAdapter.ts`) so default
 * actions never import from `canvas/` — that back-edge would create an
 * `interactions → canvas → interactions` cycle. Mirrors `moveGestureAdapter`,
 * widened to all op-apply methods.
 */
import type { Node, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';

export function defaultCommitAdapter<TPose>(scene: Scene<unknown, string, TPose>) {
  return {
    getNode: (id: string) => scene.get(asNodeId(id)),
    getNodes: () => {
      const out: (Node<unknown, string, TPose> | undefined)[] = [];
      for (const id of scene.renderOrder()) {
        const n = scene.get(id);
        if (n) out.push(n);
      }
      return out;
    },
    getPose: (id: string) => scene.get(asNodeId(id))!.pose,
    getParent: (id: string) => scene.get(asNodeId(id))?.parent ?? null,
    setPose: (id: string, pose: TPose) => scene.setPose(asNodeId(id), pose),
    setParent: (id: string, parentId: string | null) =>
      scene.move(asNodeId(id), parentId == null ? null : asNodeId(parentId)),
    setData: (id: string, data: unknown) => scene.update(asNodeId(id), { data } as never),
    setLayer: (id: string, layer: string) => scene.setLayer(asNodeId(id), layer as never),
    removeNode: (id: string) => scene.remove(asNodeId(id)),
    insertNode: (node: Node<unknown, string, TPose>) =>
      scene.add({
        kind: node.kind,
        layer: node.layer,
        pose: node.pose,
        data: node.data,
        id: node.id,
        ...(node.parent != null ? { parent: node.parent } : {}),
      }),
  };
}
