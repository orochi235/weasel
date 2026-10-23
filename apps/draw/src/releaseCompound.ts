import { asNodeId, boundsOfPath, PATH_M, pathInWorld, splitSubpaths, type NodeId } from '@weasel-js/core';
import type { DrawScene } from './drawDocument';

/** Whether any leaf among `ids` holds a polygon path with more than one subpath. */
export function hasCompoundPath(scene: DrawScene, ids: readonly string[]): boolean {
  return ids.some((id) => {
    const node = scene.get(asNodeId(id));
    if (node?.kind !== 'mark' || node.data.path?.kind !== 'polygon') return false;
    let moves = 0;
    for (const command of node.data.path.commands) if (command === PATH_M && ++moves >= 2) return true;
    return false;
  });
}

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
      if (!node || node.kind !== 'mark') continue;
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
          kind: 'mark',
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
