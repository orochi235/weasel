/**
 * `layered` — ranks running one way, nodes running across.
 *
 * The flowchart / pipeline layout: an edge points from one rank to the next, so
 * reading down the page is reading the order things happen in. Ranks come from
 * longest-path layering, which puts every node as far along as its deepest
 * predecessor allows.
 *
 * Cycles do not disqualify a graph. A depth-first walk in graph order names the
 * edges that close a cycle, layering ignores those, and they draw as edges
 * running back up the page — which is what a reader expects a loop to look
 * like. Which edges get named depends only on the node order, so it is the same
 * every run.
 *
 * This is not crossing-minimization: within a rank, nodes keep the order they
 * already have on the cross axis. An author who dragged two branches into an
 * order gets that order back, and re-running the layout is free.
 */
import type { Graph, GraphNode } from './graph';
import {
  DEFAULT_NODE_GAP,
  DEFAULT_RANK_GAP,
  axesFor,
  extent,
  graphOrder,
  packAcross,
  seededOrder,
  settle,
  type LayoutFn,
  type Slot,
} from './layout';

/** Edge ids that close a cycle, found by a depth-first walk in graph order. */
export function backEdges(graph: Graph): Set<string> {
  const back = new Set<string>();
  const done = new Set<string>();
  const onStack = new Set<string>();

  const walk = (id: string): void => {
    if (done.has(id)) return;
    onStack.add(id);
    for (const edge of graph.outgoing(id)) {
      if (onStack.has(edge.to)) back.add(edge.id);
      else walk(edge.to);
    }
    onStack.delete(id);
    done.add(id);
  };

  for (const node of graph.nodes) walk(node.id);
  return back;
}

/** Longest-path rank per node: one past its deepest predecessor. */
export function ranksOf(graph: Graph, back: ReadonlySet<string>): Map<string, number> {
  const ranks = new Map<string, number>();
  const resolving = new Set<string>();

  const rankOf = (id: string): number => {
    const known = ranks.get(id);
    if (known !== undefined) return known;
    // Only reachable if `back` missed an edge; guarding here keeps a bad
    // cycle-breaker from recursing forever rather than reporting a wrong rank.
    if (resolving.has(id)) return 0;
    resolving.add(id);
    let rank = 0;
    for (const edge of graph.incoming(id)) {
      if (back.has(edge.id)) continue;
      rank = Math.max(rank, rankOf(edge.from) + 1);
    }
    resolving.delete(id);
    ranks.set(id, rank);
    return rank;
  };

  for (const node of graph.nodes) rankOf(node.id);
  return ranks;
}

export const layered: LayoutFn = (graph, opts = {}) => {
  const axes = axesFor(opts.direction);
  const nodeGap = opts.nodeGap ?? DEFAULT_NODE_GAP;
  const rankGap = opts.rankGap ?? DEFAULT_RANK_GAP;
  const order = graphOrder(graph);

  const ranks = ranksOf(graph, backEdges(graph));
  const byRank = new Map<number, GraphNode[]>();
  for (const node of graph.nodes) {
    const rank = ranks.get(node.id) ?? 0;
    const list = byRank.get(rank);
    if (list === undefined) byRank.set(rank, [node]);
    else list.push(node);
  }

  const rows = [...byRank.keys()].sort((a, b) => a - b);
  const packed = new Map<number, ReturnType<typeof packAcross>>();
  let widest = 0;
  for (const rank of rows) {
    const row = seededOrder(byRank.get(rank)!, axes.cross, order);
    const p = packAcross(row, axes.cross, nodeGap);
    packed.set(rank, p);
    widest = Math.max(widest, p.span);
  }

  const slots = new Map<string, Slot>();
  let along = 0;
  for (const rank of rows) {
    const row = byRank.get(rank)!;
    const p = packed.get(rank)!;
    const indent = (widest - p.span) / 2;
    const depth = Math.max(0, ...row.map((n) => extent(n.bounds, axes.rank)));
    for (const node of row) {
      slots.set(node.id, {
        cross: indent + p.at.get(node.id)!,
        // Centered in its rank's band, so a tall node does not push its
        // neighbors' edges off the line they read along.
        rank: along + (depth - extent(node.bounds, axes.rank)) / 2,
      });
    }
    along += depth + rankGap;
  }

  return settle(graph, slots, opts);
};
