import type { TreeDropTarget } from '../../dropTarget';
import type { TreeNode } from './Tree';
import { siblingsOf } from './treeMoves';

/** Applies an `onMove` result to a node list, for stories and tests that need rows to land. */
export function applyMove(nodes: readonly TreeNode[], ids: readonly string[], t: TreeDropTarget): TreeNode[] {
  const taken: TreeNode[] = [];
  const strip = (list: readonly TreeNode[]): TreeNode[] =>
    list.flatMap((n) => {
      if (ids.includes(n.id)) { taken.push(n); return []; }
      return [n.children ? { ...n, children: strip(n.children) } : n];
    });
  const rest = strip(nodes);
  const at = siblingsOf(nodes, t.parentId).slice(0, t.index).filter((n) => !ids.includes(n.id)).length;
  const insert = (list: readonly TreeNode[], parent: string | null): TreeNode[] => {
    if (parent === t.parentId) return [...list.slice(0, at), ...taken, ...list.slice(at)];
    return list.map((n) => (n.children ? { ...n, children: insert(n.children, n.id) } : n));
  };
  return insert(rest, null);
}

/** Applies an `onCopy` result to a node list: a copy of each row lands, under an id of its own. */
export function applyCopy(nodes: readonly TreeNode[], ids: readonly string[], t: TreeDropTarget, stamp: string): TreeNode[] {
  const fresh = (n: TreeNode): TreeNode => ({ ...n, id: `${n.id}-${stamp}`, ...(n.children ? { children: n.children.map(fresh) } : {}) });
  const copies: TreeNode[] = [];
  const find = (list: readonly TreeNode[]) => {
    for (const n of list) {
      if (ids.includes(n.id)) copies.push(fresh(n));
      else if (n.children) find(n.children);
    }
  };
  find(nodes);
  const insert = (list: readonly TreeNode[], parent: string | null): TreeNode[] => {
    if (parent === t.parentId) return [...list.slice(0, t.index), ...copies, ...list.slice(t.index)];
    return list.map((n) => (n.children ? { ...n, children: insert(n.children, n.id) } : n));
  };
  return insert(nodes, null);
}
