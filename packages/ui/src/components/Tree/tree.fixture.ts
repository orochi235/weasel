/**
 * Random trees for the tree's property tests; the plain model of a move they check its helpers against is
 * `Tree.fixtures`' `applyMove`, the one the stories land rows with.
 */
import fc from 'fast-check';
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
