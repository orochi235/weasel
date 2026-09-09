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
import type { Graph, GraphNode } from './graph';
import {
  DEFAULT_NODE_GAP,
  DEFAULT_RANK_GAP,
  axesFor,
  extent,
  graphOrder,
  seededOrder,
  settle,
  type LayoutFn,
  type Slot,
} from './layout';

interface Forest {
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

export const tree: LayoutFn = (graph, opts = {}) => {
  const axes = axesFor(opts.direction);
  const nodeGap = opts.nodeGap ?? DEFAULT_NODE_GAP;
  const rankGap = opts.rankGap ?? DEFAULT_RANK_GAP;
  const { roots, children, depth } = forestOf(graph, axes.cross);

  const bands = new Map<number, number>();
  for (const node of graph.nodes) {
    const at = depth.get(node.id) ?? 0;
    bands.set(at, Math.max(bands.get(at) ?? 0, extent(node.bounds, axes.rank)));
  }
  const bandStart = new Map<number, number>();
  let along = 0;
  for (const at of [...bands.keys()].sort((a, b) => a - b)) {
    bandStart.set(at, along);
    along += bands.get(at)! + rankGap;
  }

  const slots = new Map<string, Slot>();

  /** How wide `node`'s whole subtree is on the cross axis: its children's
   *  blocks side by side, or the node itself when that is wider. */
  const measured = new Map<string, number>();
  const measure = (node: GraphNode): number => {
    const known = measured.get(node.id);
    if (known !== undefined) return known;
    const kids = children.get(node.id) ?? [];
    let width = 0;
    for (const child of kids) width += measure(child);
    if (kids.length > 0) width += nodeGap * (kids.length - 1);
    const block = Math.max(extent(node.bounds, axes.cross), width);
    measured.set(node.id, block);
    return block;
  };

  /** Place `node`'s subtree with its block starting at `from`. */
  const place = (node: GraphNode, from: number): void => {
    const kids = children.get(node.id) ?? [];
    const block = measure(node);
    const width = kids.reduce((sum, k) => sum + measure(k), 0)
      + Math.max(0, kids.length - 1) * nodeGap;

    let cursor = from + (block - width) / 2;
    for (const child of kids) {
      place(child, cursor);
      cursor += measure(child) + nodeGap;
    }

    const own = extent(node.bounds, axes.cross);
    const at = depth.get(node.id) ?? 0;
    slots.set(node.id, {
      cross: from + (block - own) / 2,
      rank: bandStart.get(at)! + (bands.get(at)! - extent(node.bounds, axes.rank)) / 2,
    });
  };

  let cursor = 0;
  for (const root of roots) {
    place(root, cursor);
    cursor += measure(root) + nodeGap;
  }

  return settle(graph, slots, opts);
};
