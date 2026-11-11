/**
 * Random trees for the tree's property tests, and a plain model of a move to check its helpers against.
 */
import fc from 'fast-check';
import type { TreeDropTarget } from '../../dropTarget';
import type { DropRow } from '../../dropTarget';
import type { TreeNode } from './treeTypes';

type Shape = { kids: Shape[] | null };

const shape: fc.Arbitrary<Shape[]> = fc.letrec<{ node: Shape; list: Shape[] }>((tie) => ({
  node: fc.oneof({ depthSize: 'small', withCrossShrink: true },
    { arbitrary: fc.constant({ kids: null }), weight: 2 },
    { arbitrary: tie('list').map((kids) => ({ kids })), weight: 3 }),
  list: fc.array(tie('node'), { maxLength: 5, depthIdentifier: 'tree' }),
})).list;

/** A forest of up to a few dozen nodes, ids `n0`, `n1`, … in tree order; a branch may be empty. */
export const forest: fc.Arbitrary<TreeNode[]> = shape.map((list) => {
  let next = 0;
  const build = (s: Shape[]): TreeNode[] => s.map((n) => {
    const id = `n${next++}`;
    return n.kids === null ? { id, label: id } : { id, label: id, children: build(n.kids) };
  });
  return build(list);
});

/** Every id, in tree order. */
export function idsOf(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((n) => [n.id, ...(n.children ? idsOf(n.children) : [])]);
}

/** Every branch id, in tree order. */
export function branchIds(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((n) => (n.children ? [n.id, ...branchIds(n.children)] : []));
}

/** The tree's shape alone, for comparing two trees. */
export function outline(nodes: readonly TreeNode[]): unknown {
  return nodes.map((n) => (n.children ? [n.id, outline(n.children)] : n.id));
}

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

/** The rows a tree shows with `expanded` open, `height` px each, as `useTreeDrag` measures them. */
export function rowsOf(nodes: readonly TreeNode[], expanded: ReadonlySet<string>, height = 20): DropRow[] {
  const rows: DropRow[] = [];
  const walk = (list: readonly TreeNode[], parentId: string | null, level: number) => list.forEach((n, index) => {
    rows.push({
      id: n.id, parentId, level, index, branch: !!n.children, expanded: expanded.has(n.id),
      childCount: n.children?.length ?? 0, top: rows.length * height, height,
    });
    if (n.children && expanded.has(n.id)) walk(n.children, n.id, level + 1);
  });
  walk(nodes, null, 1);
  return rows;
}
