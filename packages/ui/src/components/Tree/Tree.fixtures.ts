import type { TreeDropTarget } from '../../dropTarget';
import type { TreeNode } from './treeTypes';

/** `nodes` with `ids` taken out and put back, in tree order, at `target`, whose index counts before they leave. */
export function applyMove(nodes: readonly TreeNode[], ids: readonly string[], target: TreeDropTarget): TreeNode[] {
  const set = new Set(ids);
  const taken: TreeNode[] = [];
  const lift = (list: readonly TreeNode[]): TreeNode[] => list.flatMap((n) => {
    if (set.has(n.id)) { taken.push(n); return []; }
    return [n.children ? { ...n, children: lift(n.children) } : n];
  });
  const siblingsBefore = (list: readonly TreeNode[]): number =>
    list.slice(0, target.index).filter((n) => set.has(n.id)).length;
  const place = (list: readonly TreeNode[], original: readonly TreeNode[]): TreeNode[] => {
    const out = [...list];
    out.splice(target.index - siblingsBefore(original), 0, ...taken);
    return out;
  };
  const findIn = (list: readonly TreeNode[], id: string): TreeNode | undefined => {
    for (const n of list) { if (n.id === id) return n; const hit = n.children && findIn(n.children, id); if (hit) return hit; }
    return undefined;
  };
  const lifted = lift(nodes);
  if (target.parentId === null) return place(lifted, nodes);
  const original = findIn(nodes, target.parentId)?.children ?? [];
  const into = (list: readonly TreeNode[]): TreeNode[] => list.map((n) => {
    if (n.id === target.parentId) return { ...n, children: place(n.children ?? [], original) };
    return n.children ? { ...n, children: into(n.children) } : n;
  });
  return into(lifted);
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
  return insertAt(nodes, copies, t);
}

/** `added` set among `t.parentId`'s children at `t.index`. */
export function insertAt(nodes: readonly TreeNode[], added: readonly TreeNode[], t: TreeDropTarget): TreeNode[] {
  const insert = (list: readonly TreeNode[], parent: string | null): TreeNode[] => {
    if (parent === t.parentId) return [...list.slice(0, t.index), ...added, ...list.slice(t.index)];
    return list.map((n) => (n.children ? { ...n, children: insert(n.children, n.id) } : n));
  };
  return insert(nodes, null);
}
