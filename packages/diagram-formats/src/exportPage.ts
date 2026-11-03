/** Which page a node exports to. */
import { pageHolding, pageOfNode, type NodeId, type PlacedPage, type Scene } from '@weasel-js/core';
import { documentBoundsOf } from '@weasel-js/diagram';

/**
 * The page of `pages` node `id` exports to: its page ancestor's
 * (`pageOfNode`), else, for a node on the pasteboard, the one holding its
 * outermost container's box (`pageHolding`). `null` when `pages` is empty.
 */
export function exportPageOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>, pages: readonly PlacedPage[], id: NodeId,
): string | null {
  const under = pageOfNode(scene, id);
  if (under !== null) return under;
  let root = id;
  for (let up = scene.get(root)?.parent; up != null; up = scene.get(root)?.parent) root = up;
  return pageHolding(pages, documentBoundsOf(scene as never, scene.get(root) as never))?.id ?? null;
}
