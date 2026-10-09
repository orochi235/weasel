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
 * This is not crossing-minimization by default (`order: 'barycenter'` does
 * reorder ranks): within a rank, nodes keep the order they
 * already have on the cross axis. An author who dragged two branches into an
 * order gets that order back, and re-running the layout is free.
 */
import { barycenterOrder } from './barycenter';
import { packClusters, rankGaps } from './cluster';
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

/** The ranked layout: each edge points one rank further along `direction`.
 *  Within a rank, nodes keep their current cross-axis order, so a re-run
 *  moves nothing — except under `order: 'barycenter'`, which reorders them. */
export const layered: LayoutFn = (graph, opts = {}) => {
  const axes = axesFor(opts.direction);
  const nodeGap = opts.nodeGap ?? DEFAULT_NODE_GAP;
  const rankGap = opts.rankGap ?? DEFAULT_RANK_GAP;
  const order = graphOrder(graph);

  const back = backEdges(graph);
  const ranks = ranksOf(graph, back);
  const byRank = new Map<number, GraphNode[]>();
  for (const node of graph.nodes) {
    const rank = ranks.get(node.id) ?? 0;
    const list = byRank.get(rank);
    if (list === undefined) byRank.set(rank, [node]);
    else list.push(node);
  }

  const rows = [...byRank.keys()].sort((a, b) => a - b);
  let ordered = rows.map((rank) => seededOrder(byRank.get(rank)!, axes.cross, order));
  if (opts.order === 'barycenter') ordered = barycenterOrder(graph, ordered, back);
  const packed = ordered.map((row) => packAcross(row, axes.cross, nodeGap));
  const widest = Math.max(0, ...packed.map((p) => p.span));
  const preferred = new Map<string, number>();
  for (const [i, row] of ordered.entries()) {
    const indent = (widest - packed[i]!.span) / 2;
    for (const node of row) preferred.set(node.id, indent + packed[i]!.at.get(node.id)!);
  }
  const grouped = (graph.groups?.length ?? 0) > 0;
  const crossAt = grouped ? packClusters(graph, ordered, preferred, axes, nodeGap) : preferred;
  const gaps = grouped ? rankGaps(graph, ordered, axes, rankGap) : ordered.slice(1).map(() => rankGap);

  const slots = new Map<string, Slot>();
  let along = 0;
  for (const [i, row] of ordered.entries()) {
    const depth = Math.max(0, ...row.map((n) => extent(n.bounds, axes.rank)));
    for (const node of row) {
      slots.set(node.id, {
        cross: crossAt.get(node.id)!,
        // Centered in its rank's band, so a tall node does not push its
        // neighbors' edges off the line they read along.
        rank: along + (depth - extent(node.bounds, axes.rank)) / 2,
      });
    }
    along += depth + (gaps[i] ?? 0);
  }

  return settle(graph, slots, opts);
};
