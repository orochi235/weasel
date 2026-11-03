import { isPageStructure, type NodeId, type Scene } from '@weasel-js/core';

/** The tops of what a drawing holds, from `ids` (default the scene's roots): each id, but the page run
 *  and each page by what they hold, in order. What a file writes, since it places content in the world
 *  and lists its pages apart. */
export function contentRoots<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  ids: readonly (NodeId | string)[] = scene.roots,
): NodeId[] {
  return ids.flatMap((id) => isPageStructure(scene.get(id as NodeId))
    ? contentRoots(scene, scene.childrenOf(id as NodeId))
    : [id as NodeId]);
}
