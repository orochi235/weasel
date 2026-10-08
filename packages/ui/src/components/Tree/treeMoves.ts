import type { TreeDropTarget } from '../../dropTarget';
import type { TreeNode } from './Tree';

/** Each node's parent id; `null` at the top level. */
export function parentsOf(nodes: readonly TreeNode[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const walk = (list: readonly TreeNode[], parent: string | null) => {
    for (const n of list) {
      out.set(n.id, parent);
      if (n.children) walk(n.children, n.id);
    }
  };
  walk(nodes, null);
  return out;
}

function siblingsOf(nodes: readonly TreeNode[], parentId: string | null): readonly TreeNode[] {
  if (parentId === null) return nodes;
  const find = (list: readonly TreeNode[]): readonly TreeNode[] | undefined => {
    for (const n of list) {
      if (n.id === parentId) return n.children ?? [];
      const hit = n.children && find(n.children);
      if (hit) return hit;
    }
    return undefined;
  };
  return find(nodes) ?? [];
}

function treeOrder(nodes: readonly TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: readonly TreeNode[]) => { for (const n of list) { out.push(n.id); if (n.children) walk(n.children); } };
  walk(nodes);
  return out;
}

function hasAncestorIn(parents: Map<string, string | null>, id: string, set: ReadonlySet<string>): boolean {
  for (let p = parents.get(id) ?? null; p !== null; p = parents.get(p) ?? null) if (set.has(p)) return true;
  return false;
}

/** What a drag from `id` carries: the selection in tree order if `id` is in it, else `id` alone. A node travels
 *  with a selected ancestor rather than on its own. */
export function draggedIdsFor(nodes: readonly TreeNode[], selected: ReadonlySet<string>, id: string): string[] {
  if (!selected.has(id)) return [id];
  const parents = parentsOf(nodes);
  return treeOrder(nodes).filter((x) => selected.has(x) && !hasAncestorIn(parents, x, selected));
}

/** Whether `target` is one of `ids` or sits beneath one. */
export function landsInside(nodes: readonly TreeNode[], ids: readonly string[], target: TreeDropTarget): boolean {
  if (target.parentId === null) return false;
  const set = new Set(ids);
  return set.has(target.parentId) || hasAncestorIn(parentsOf(nodes), target.parentId, set);
}

/** Whether dropping `ids` at `target` leaves them where they are. */
export function isNoopMove(nodes: readonly TreeNode[], ids: readonly string[], target: TreeDropTarget): boolean {
  const parents = parentsOf(nodes);
  if (!ids.every((id) => (parents.get(id) ?? null) === target.parentId)) return false;
  const sibs = siblingsOf(nodes, target.parentId).map((n) => n.id);
  const at = ids.map((id) => sibs.indexOf(id)).sort((a, b) => a - b);
  const contiguous = at.every((v, i) => i === 0 || v === at[i - 1]! + 1);
  return contiguous && target.index >= at[0]! && target.index <= at[at.length - 1]! + 1;
}

export type KeyboardMove = 'up' | 'down' | 'out' | 'in';

/** Where a keyboard move sends `ids`, which share a parent; `null` when it cannot go that way. */
export function keyboardTarget(
  nodes: readonly TreeNode[],
  ids: readonly string[],
  move: KeyboardMove,
): TreeDropTarget | null {
  const parents = parentsOf(nodes);
  const parentId = parents.get(ids[0]!) ?? null;
  const sibs = siblingsOf(nodes, parentId);
  const at = ids.map((id) => sibs.findIndex((n) => n.id === id)).sort((a, b) => a - b);
  const first = at[0]!;
  const last = at[at.length - 1]!;
  switch (move) {
    case 'up': return first > 0 ? { parentId, index: first - 1 } : null;
    case 'down': return last < sibs.length - 1 ? { parentId, index: last + 2 } : null;
    case 'out': {
      if (parentId === null) return null;
      const grand = parents.get(parentId) ?? null;
      return { parentId: grand, index: siblingsOf(nodes, grand).findIndex((n) => n.id === parentId) + 1 };
    }
    case 'in': {
      const prev = sibs[first - 1];
      return prev?.children ? { parentId: prev.id, index: prev.children.length } : null;
    }
  }
}
