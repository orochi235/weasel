/** The audit areas nested by their ids' paths: `core` holds `core.canvas` and `core.domains`, and so on. */

/** A frame grouping areas that share a path, or one area. An area is always exactly one leaf. */
export type AreaTreeNode =
  | { readonly kind: 'frame'; readonly name: string; readonly files: number; readonly children: readonly AreaTreeNode[] }
  | { readonly kind: 'area'; readonly id: string; readonly files: number };

interface Trie {
  readonly name: string;
  area?: { id: string; files: number };
  readonly children: Map<string, Trie>;
}

const filesOf = (nodes: readonly AreaTreeNode[]) => nodes.reduce((n, c) => n + c.files, 0);

/** A trie node as the tree draws it: a frame holding its own area beside the areas under it, or the area alone. A
 *  frame left with one child is that child, so no chain of one-child boxes forms. */
function nodeOf(trie: Trie): AreaTreeNode {
  const children: AreaTreeNode[] = [
    ...(trie.area ? [{ kind: 'area' as const, id: trie.area.id, files: trie.area.files }] : []),
    ...[...trie.children.values()].map(nodeOf),
  ];
  if (children.length === 1) return children[0]!;
  return { kind: 'frame', name: trie.name, files: filesOf(children), children };
}

/** Every area under the frames its dot-separated id's prefixes make, top-level packages first. */
export function areaTree(areas: readonly { id: string; files: number }[]): AreaTreeNode[] {
  const root: Trie = { name: '', children: new Map() };
  for (const a of areas) {
    let at = root;
    for (const seg of a.id.split('.')) {
      const name = at.name ? `${at.name}.${seg}` : seg;
      let next = at.children.get(seg);
      if (!next) at.children.set(seg, (next = { name, children: new Map() }));
      at = next;
    }
    at.area = { id: a.id, files: a.files };
  }
  return [...root.children.values()].map(nodeOf);
}

/** Every area id in `nodes`, depth first. */
export function leavesOf(nodes: readonly AreaTreeNode[]): string[] {
  return nodes.flatMap((n) => (n.kind === 'area' ? [n.id] : leavesOf(n.children)));
}
