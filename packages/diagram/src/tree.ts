/**
 * `tree` — a parent centered over the block its children occupy.
 *
 * The hierarchy layout: org charts, file trees, decision trees. Depth is the
 * rank axis, so every child sits one band past its parent, and a subtree is
 * packed as a solid block so two siblings' descendants never interleave.
 *
 * A graph that is not a tree still lays out. Roots are the nodes nothing points
 * at, in graph order; a node reachable from two parents belongs to whichever
 * the depth-first walk reaches first; and anything the walk never reaches — a
 * disconnected part, or a pure cycle — becomes a root of its own. So the answer
 * is always a forest, and which forest depends only on the node order.
 *
 * The block packing is deliberately not Reingold–Tilford: it never slides a
 * deep subtree under a shallow neighbor's overhang. That costs horizontal
 * space and buys an invariant an author can rely on — a subtree's extent is a
 * rectangle, and dragging one never lands it inside another.
 */
import { packClusters, rankGaps } from './cluster';
import type { Graph, GraphNode } from './graph';
import {
  DEFAULT_NODE_GAP,
  DEFAULT_RANK_GAP,
  axesFor,
  extent,
  graphOrder,
  seededOrder,
  settle,
  untilSettled,
  type LayoutFn,
  type Slot,
} from './layout';

/** A graph read as trees: its roots, each node's children in order, and each node's depth. */
export interface Forest {
  roots: GraphNode[];
  children: Map<string, GraphNode[]>;
  depth: Map<string, number>;
}

/** The forest a depth-first walk in graph order finds. Exported because "which
 *  node ended up whose child" is the question anyone debugging a tree layout
 *  asks first. */
export function forestOf(graph: Graph, crossAxis: 'x' | 'y'): Forest {
  const order = graphOrder(graph);
  const children = new Map<string, GraphNode[]>();
  const depth = new Map<string, number>();
  const roots: GraphNode[] = [];

  const claim = (node: GraphNode, at: number): void => {
    depth.set(node.id, at);
    const kids: GraphNode[] = [];
    for (const edge of graph.outgoing(node.id)) {
      if (edge.to === node.id || depth.has(edge.to)) continue;
      const child = graph.node(edge.to);
      if (child === undefined) continue;
      // Claimed on sight rather than inside the recursion, so two siblings
      // sharing a descendant cannot both take it.
      depth.set(child.id, at + 1);
      kids.push(child);
    }
    const ordered = seededOrder(kids, crossAxis, order);
    children.set(node.id, ordered);
    for (const child of ordered) claim(child, at + 1);
  };

  const rootish = graph.nodes.filter((node) =>
    graph.incoming(node.id).every((edge) => edge.from === node.id));
  for (const node of seededOrder(rootish, crossAxis, order)) {
    if (depth.has(node.id)) continue;
    roots.push(node);
    claim(node, 0);
  }
  // Whatever the walk could not reach: a disconnected part, or a component
  // every node of which is inside a cycle.
  for (const node of graph.nodes) {
    if (depth.has(node.id)) continue;
    roots.push(node);
    claim(node, 0);
  }

  return { roots, children, depth };
}

/** Subtrees packed as solid blocks on one axis. `span` is how much room a node's
 *  whole subtree takes: its children's blocks side by side, or the node itself
 *  when that is wider. `lay` writes the low corner of every node in a subtree
 *  whose block starts at `from`, each parent centered over its children. */
export function subtreeBlocks(
  children: ReadonlyMap<string, readonly GraphNode[]>,
  axis: 'x' | 'y',
  gap: number,
): { span(node: GraphNode): number; lay(node: GraphNode, from: number, into: Map<string, number>): void } {
  const measured = new Map<string, number>();
  const kidsSpan = (kids: readonly GraphNode[]): number =>
    kids.reduce((sum, k) => sum + span(k), 0) + Math.max(0, kids.length - 1) * gap;
  const span = (node: GraphNode): number => {
    const known = measured.get(node.id);
    if (known !== undefined) return known;
    const block = Math.max(extent(node.bounds, axis), kidsSpan(children.get(node.id) ?? []));
    measured.set(node.id, block);
    return block;
  };
  const lay = (node: GraphNode, from: number, into: Map<string, number>): void => {
    const kids = children.get(node.id) ?? [];
    const block = span(node);
    let cursor = from + (block - kidsSpan(kids)) / 2;
    for (const child of kids) {
      lay(child, cursor, into);
      cursor += span(child) + gap;
    }
    into.set(node.id, from + (block - extent(node.bounds, axis)) / 2);
  };
  return { span, lay };
}

/** The hierarchy layout: each parent centered over its children's block, one
 *  rank per depth. A graph that is not a tree lays out as the forest
 *  {@link forestOf} reads from it. */
export const tree: LayoutFn = (graph, opts = {}) =>
  ((graph.groups?.length ?? 0) > 0 ? untilSettled(treeOnce, graph, opts) : treeOnce(graph, opts));

const treeOnce: LayoutFn = (graph, opts = {}) => {
  const axes = axesFor(opts.direction);
  const nodeGap = opts.nodeGap ?? DEFAULT_NODE_GAP;
  const rankGap = opts.rankGap ?? DEFAULT_RANK_GAP;
  const { roots, children, depth } = forestOf(graph, axes.cross);

  const bands = new Map<number, number>();
  for (const node of graph.nodes) {
    const at = depth.get(node.id) ?? 0;
    bands.set(at, Math.max(bands.get(at) ?? 0, extent(node.bounds, axes.rank)));
  }
  const depths = [...bands.keys()].sort((a, b) => a - b);
  const rowsAt = depths.map((at) => graph.nodes.filter((n) => (depth.get(n.id) ?? 0) === at));
  const grouped = (graph.groups?.length ?? 0) > 0;
  const gaps = grouped ? rankGaps(graph, rowsAt, axes, rankGap) : depths.slice(1).map(() => rankGap);
  const bandStart = new Map<number, number>();
  let along = 0;
  for (const [i, at] of depths.entries()) {
    bandStart.set(at, along);
    along += bands.get(at)! + (gaps[i] ?? 0);
  }

  const slots = new Map<string, Slot>();
  const blocks = subtreeBlocks(children, axes.cross, nodeGap);
  const crossAt = new Map<string, number>();
  let cursor = 0;
  for (const root of roots) {
    blocks.lay(root, cursor, crossAt);
    cursor += blocks.span(root) + nodeGap;
  }
  for (const node of graph.nodes) {
    const at = depth.get(node.id) ?? 0;
    slots.set(node.id, {
      cross: crossAt.get(node.id)!,
      rank: bandStart.get(at)! + (bands.get(at)! - extent(node.bounds, axes.rank)) / 2,
    });
  }

  if (grouped) {
    // The subtree blocks are where each node would go; groups then push them
    // apart only as far as their columns need.
    const preferred = new Map([...slots].map(([id, slot]) => [id, slot.cross]));
    const ordered = rowsAt.map((row) => [...row].sort((a, b) => preferred.get(a.id)! - preferred.get(b.id)!));
    const crossAt = packClusters(graph, ordered, preferred, axes, nodeGap);
    for (const [id, slot] of slots) slots.set(id, { ...slot, cross: crossAt.get(id) ?? slot.cross });
  }

  return settle(graph, slots, opts);
};
