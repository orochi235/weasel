import { asNodeId, boundsOfPath, pathInWorld, splitSubpaths, type NodeId, type Scene } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './App';

type DrawScene = Scene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;

/**
 * Split each compound path among `ids` into one node per subpath, each in the
 * source's place: its parent, its layer, and its position in the stack.
 * Returns the ids to select afterward — the pieces, and any id left whole.
 */
export function releaseCompoundPaths(scene: DrawScene, ids: readonly string[]): NodeId[] {
  const newIds: NodeId[] = [];
  scene.batch('Release compound path', () => {
    for (const id of ids) {
      const nid = asNodeId(id);
      const node = scene.get(nid);
      if (!node || node.kind !== 'leaf') continue;
      const path = node.data.path;
      // Baked into world coordinates, rotation included: a subpath placed by
      // its own bounds would otherwise lose its offset from its siblings.
      const worldPath = path?.kind === 'polygon' ? pathInWorld(path, node.pose) : undefined;
      const parts = worldPath?.kind === 'polygon' ? splitSubpaths(worldPath) : [];
      if (parts.length < 2) {
        newIds.push(nid);
        continue;
      }
      const siblings = node.parent == null ? scene.roots : scene.childrenOf(node.parent);
      const at = siblings.indexOf(nid);
      scene.remove(nid);
      parts.forEach((sub, i) => {
        const b = boundsOfPath(sub);
        newIds.push(scene.add({
          kind: 'leaf',
          layer: node.layer,
          parent: node.parent,
          ...(at >= 0 ? { index: at + i } : {}),
          pose: { x: b.x, y: b.y, width: b.width, height: b.height },
          data: { ...node.data, path: sub },
        }));
      });
    }
  });
  return newIds;
}
