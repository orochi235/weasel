/** What the structure tree takes where: the rules a drag into it is held to. */
import type { TreeDragEffect } from '@weasel-js/ui';
import {
  childrenOf, fitsUnder, type LinkRule, nodeAt, type SchemaNode, type SchemaRoot, topLevelAllows, withinDepth,
} from '@weasel-js/prefs/edit';
import type { PaletteDrag } from './Palette';
import { treeTakesNew } from './previewDrop';

/** The drop rules of a tree over `schema`: what a link sets down, how deep groups nest, and whether a group under the root is a page. */
export function treeDropRulesFor(schema: SchemaRoot, links: LinkRule, maxDepth: number | undefined, pageless: boolean) {
  const nodesFor = (ids: readonly string[]): SchemaNode[] => ids.map((id) => nodeAt(schema, id)!);
  /** Whether a drag of the nodes at `ids` with `effect` has anything to set down. */
  const canLand = (ids: readonly string[], effect: TreeDragEffect): boolean =>
    effect !== 'link' || ids.every((id) => links.can(schema, id));
  /** What a drag would set down: the nodes themselves, or aliases of them. */
  const landing = (ids: readonly string[], effect: TreeDragEffect): SchemaNode[] =>
    effect === 'link' ? ids.map((id) => links.of(schema, id)) : nodesFor(ids);
  /** Whether the nodes at `ids`, which the schema holds, may be dropped under tree row `parentId`. */
  const takes = (ids: readonly string[], parentId: string | null): boolean => {
    if (!withinDepth(parentId, nodesFor(ids), maxDepth)) return false;
    const top = topLevelAllows(schema, ids, parentId, pageless);
    if (top !== undefined) return top;
    const parent = nodeAt(schema, parentId)!;
    return !!childrenOf(parent) && ids.every((id) => fitsUnder(parent, nodeAt(schema, id)!));
  };
  /** Whether a drag lands under tree row `parentId`: one of the tree's own rows at `ids`, else the palette's `held`. */
  const takesDrag = (ids: readonly string[], parentId: string | null, effect: TreeDragEffect, held: PaletteDrag | null): boolean => {
    if (ids.length === 0) {
      if (held === null) return false;
      return held.from === undefined ? treeTakesNew(schema, held.node, parentId, maxDepth, pageless) : takes(held.from, parentId);
    }
    if (effect === 'link') return canLand(ids, effect) && landing(ids, effect).every((node) => treeTakesNew(schema, node, parentId, maxDepth, pageless));
    return takes(ids, parentId);
  };
  return { canLand, landing, takesDrag };
}
