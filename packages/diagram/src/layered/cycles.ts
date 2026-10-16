/** Which edges a layered layout turns around so that no cycle is left. */
import type { Graph } from '../graph';

/** Edge ids that close a cycle, found by a depth-first walk in graph order.
 *  Which edges get named depends only on the node order, so it is the same
 *  every run. A self-loop is not one: it points neither way. */
export function backEdges(graph: Graph): Set<string> {
  const back = new Set<string>();
  const done = new Set<string>();
  const onStack = new Set<string>();

  const walk = (id: string): void => {
    if (done.has(id)) return;
    onStack.add(id);
    for (const edge of graph.outgoing(id)) {
      if (edge.to === id) continue;
      if (onStack.has(edge.to)) back.add(edge.id);
      else walk(edge.to);
    }
    onStack.delete(id);
    done.add(id);
  };

  for (const node of graph.nodes) walk(node.id);
  return back;
}

/** Longest-path rank per node: one past its deepest predecessor, ignoring
 *  `back`. Every node with no predecessor is rank 0. */
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
      if (back.has(edge.id) || edge.from === id) continue;
      rank = Math.max(rank, rankOf(edge.from) + 1);
    }
    resolving.delete(id);
    ranks.set(id, rank);
    return rank;
  };

  for (const node of graph.nodes) rankOf(node.id);
  return ranks;
}
