import type { TreeNode } from './Tree';

/**
 * `nodes` narrowed to those `match` accepts, plus their ancestors. A matching
 * node keeps its whole subtree; a branch with no match inside it is dropped.
 * Returns `nodes` itself when nothing is dropped.
 */
export function filterTree(
  nodes: readonly TreeNode[],
  match: (node: TreeNode) => boolean,
): readonly TreeNode[] {
  let changed = false;
  const out: TreeNode[] = [];
  for (const node of nodes) {
    if (match(node)) {
      out.push(node);
      continue;
    }
    const kids = node.children ? filterTree(node.children, match) : [];
    if (kids.length === 0) {
      changed = true;
      continue;
    }
    if (kids !== node.children) changed = true;
    out.push(kids === node.children ? node : { ...node, children: kids });
  }
  return changed ? out : nodes;
}

/** Every branch id in `nodes`, depth first — `expandedIds` for a tree with everything open. */
export function treeBranchIds(nodes: readonly TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: readonly TreeNode[]) => {
    for (const node of list) {
      if (!node.children) continue;
      out.push(node.id);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
