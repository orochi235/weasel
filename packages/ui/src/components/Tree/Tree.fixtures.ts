import type { TreeDropTarget } from '../../dropTarget';
import type { TreeNode } from './Tree';

const childrenOf = (nodes: readonly TreeNode[], parentId: string | null): readonly TreeNode[] => {
  if (parentId === null) return nodes;
  for (const n of nodes) {
    if (n.id === parentId) return n.children ?? [];
    const found = n.children && childrenOf(n.children, parentId);
    if (found?.length) return found;
  }
  return [];
};

/** Applies an `onMove` result to a node list, for stories and tests that need rows to land. */
export function applyMove(nodes: readonly TreeNode[], ids: readonly string[], t: TreeDropTarget): TreeNode[] {
  const taken: TreeNode[] = [];
  const strip = (list: readonly TreeNode[]): TreeNode[] =>
    list.flatMap((n) => {
      if (ids.includes(n.id)) { taken.push(n); return []; }
      return [n.children ? { ...n, children: strip(n.children) } : n];
    });
  const rest = strip(nodes);
  const at = childrenOf(nodes, t.parentId).slice(0, t.index).filter((n) => !ids.includes(n.id)).length;
  const insert = (list: readonly TreeNode[], parent: string | null): TreeNode[] => {
    if (parent === t.parentId) return [...list.slice(0, at), ...taken, ...list.slice(at)];
    return list.map((n) => (n.children ? { ...n, children: insert(n.children, n.id) } : n));
  };
  return insert(rest, null);
}
