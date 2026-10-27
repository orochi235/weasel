/**
 * `radial` — a mind map: the central topic in the middle, its branches
 * growing out to its right and its left.
 *
 * The root is the first root {@link forestOf} finds. Its children are dealt to
 * the two sides in graph order, each to whichever side weighs less so far,
 * counting nodes per subtree, so the first branch goes right and the map
 * stays balanced. On a map already arranged around its root, with branches
 * standing on both sides of it, a branch clear of the root keeps the side it
 * stands on, so one dragged across stays there; the rest are dealt after
 * them. A map with every branch on one side, as another layout leaves one,
 * is dealt afresh. Each side is then a horizontal `tree` growing away from the
 * root, its subtrees packed as solid blocks, and centered on the root.
 *
 * Further trees in a forest lay out the same way, stacked below the first,
 * their roots on the first one's vertical axis. `direction` and groups are
 * ignored; pins and `tolerance` behave as in every other layout.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { GraphNode } from './graph';
import { DEFAULT_NODE_GAP, DEFAULT_RANK_GAP, graphOrder, pinnedSet, translated, type LayoutFn } from './layout';
import { forestOf, subtreeBlocks } from './tree';

type Children = ReadonlyMap<string, readonly GraphNode[]>;

/** The mind-map layout: the first root in the middle, its branches balanced
 *  to its right and its left, any further trees stacked below. */
export const radial: LayoutFn = (graph, opts = {}) => {
  const nodeGap = opts.nodeGap ?? DEFAULT_NODE_GAP;
  const rankGap = opts.rankGap ?? DEFAULT_RANK_GAP;
  const { roots, children } = forestOf(graph, 'y');
  const blocks = subtreeBlocks(children, 'y', nodeGap);
  const order = graphOrder(graph);
  const placed = new Map<string, Vec2>();

  let top = 0;
  for (const root of roots) {
    const tree = mindMap(root, children, order, blocks, nodeGap, rankGap);
    for (const [id, p] of tree.at) placed.set(id, { x: p.x, y: p.y - tree.top + top });
    top += tree.bottom - tree.top + nodeGap;
  }
  return translated(graph, placed, pinnedSet(graph, opts), opts.tolerance);
};

type Blocks = ReturnType<typeof subtreeBlocks>;

/** One tree laid out around its root's center at the origin, and how far it
 *  reaches above and below. */
function mindMap(
  root: GraphNode, children: Children, order: (id: string) => number, blocks: Blocks, nodeGap: number, rankGap: number,
) {
  const at = new Map<string, Vec2>([[root.id, { x: -root.bounds.width / 2, y: -root.bounds.height / 2 }]]);
  let top = -root.bounds.height / 2;
  let bottom = root.bounds.height / 2;
  const [right, left] = sides(root, children, order);
  for (const [sign, branches] of [[1, right], [-1, left]] as const) {
    if (branches.length === 0) continue;
    const span = branches.reduce((sum, b) => sum + blocks.span(b), 0) + (branches.length - 1) * nodeGap;
    const ys = new Map<string, number>();
    let cursor = -span / 2;
    for (const branch of branches) {
      blocks.lay(branch, cursor, ys);
      cursor += blocks.span(branch) + nodeGap;
    }
    top = Math.min(top, -span / 2);
    bottom = Math.max(bottom, span / 2);
    for (const [id, x] of sideColumns(branches, children, root.bounds.width / 2 + rankGap, rankGap, sign)) {
      at.set(id, { x, y: ys.get(id)! });
    }
  }
  return { at, top, bottom };
}

/** The root's children dealt right and left, each to the lighter side, in
 *  graph order. On an arranged map, those clear of the root keep their side
 *  first. Each side keeps the order its branches already stand in. */
function sides(root: GraphNode, children: Children, order: (id: string) => number): [GraphNode[], GraphNode[]] {
  const weight = (node: GraphNode): number => 1 + (children.get(node.id) ?? []).reduce((sum, k) => sum + weight(k), 0);
  const kids = children.get(root.id) ?? [];
  const half = root.bounds.width / 2;
  const mid = root.bounds.x + half;
  const standing = (k: GraphNode): 1 | -1 | 0 => {
    const c = k.bounds.x + k.bounds.width / 2 - mid;
    return c > half ? 1 : c < -half ? -1 : 0;
  };
  const stands = new Map(kids.map((k) => [k, standing(k)]));
  const arranged = [...stands.values()].includes(1) && [...stands.values()].includes(-1);
  const right = new Set<GraphNode>();
  let r = 0;
  let l = 0;
  const dealt = arranged ? kids.filter((k) => stands.get(k) !== 0) : [];
  for (const k of dealt) {
    if (stands.get(k) === 1) { right.add(k); r += weight(k); } else l += weight(k);
  }
  for (const child of kids.filter((k) => !dealt.includes(k)).sort((a, b) => order(a.id) - order(b.id))) {
    const w = weight(child);
    if (r <= l) { right.add(child); r += w; } else l += w;
  }
  return [kids.filter((k) => right.has(k)), kids.filter((k) => !right.has(k))];
}

/** Each node's left edge on one side: one band per depth, starting `from`
 *  the root's center, a node centered in its band. `sign` is 1 for the right. */
function sideColumns(
  branches: readonly GraphNode[], children: Children, from: number, rankGap: number, sign: 1 | -1,
): Map<string, number> {
  const rows: GraphNode[][] = [];
  const visit = (node: GraphNode, depth: number): void => {
    (rows[depth] ??= []).push(node);
    for (const kid of children.get(node.id) ?? []) visit(kid, depth + 1);
  };
  for (const branch of branches) visit(branch, 0);
  const xs = new Map<string, number>();
  let start = from;
  for (const row of rows) {
    const band = Math.max(...row.map((n) => n.bounds.width));
    for (const node of row) {
      const near = start + (band - node.bounds.width) / 2;
      xs.set(node.id, sign === 1 ? near : -near - node.bounds.width);
    }
    start += band + rankGap;
  }
  return xs;
}
