/** Which edges a layered layout turns around so that no cycle is left. */
import type { Graph } from '../graph';

/** Edge ids that close a cycle, found by a depth-first walk in graph order.
 *  Which edges get named depends only on the node order, so it is the same
 *  every run. A self-loop is not one: it points neither way. */
export function backEdges(graph: Graph): Set<string> {
  const back = new Set<string>();
  const done = new Set<string>();
  const onStack = new Set<string>();

  for (const node of graph.nodes) {
    if (done.has(node.id)) continue;
    onStack.add(node.id);
    const stack = [{ id: node.id, next: 0 }];
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const edge = graph.outgoing(top.id)[top.next++];
      if (edge === undefined) {
        stack.pop();
        onStack.delete(top.id);
        done.add(top.id);
      } else if (edge.to === top.id || done.has(edge.to)) {
        continue;
      } else if (onStack.has(edge.to)) {
        back.add(edge.id);
      } else {
        onStack.add(edge.to);
        stack.push({ id: edge.to, next: 0 });
      }
    }
  }
  return back;
}

/** Longest-path rank per node: one past its deepest predecessor, ignoring
 *  `back`. Every node with no predecessor is rank 0. */
export function longestPathRanks(graph: Graph, back: ReadonlySet<string>): Map<string, number> {
  const ranks = new Map<string, number>();
  // A node still being resolved counts as rank 0, which only a missed back
  // edge can reach: a wrong rank rather than a walk that never ends.
  const resolving = new Set<string>();

  for (const node of graph.nodes) {
    if (ranks.has(node.id)) continue;
    resolving.add(node.id);
    const stack = [{ id: node.id, next: 0, rank: 0 }];
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const edge = graph.incoming(top.id)[top.next++];
      if (edge === undefined) {
        stack.pop();
        resolving.delete(top.id);
        ranks.set(top.id, top.rank);
        const below = stack[stack.length - 1];
        if (below !== undefined) below.rank = Math.max(below.rank, top.rank + 1);
        continue;
      }
      if (back.has(edge.id) || edge.from === top.id) continue;
      const known = ranks.get(edge.from) ?? (resolving.has(edge.from) ? 0 : undefined);
      if (known !== undefined) {
        top.rank = Math.max(top.rank, known + 1);
        continue;
      }
      resolving.add(edge.from);
      stack.push({ id: edge.from, next: 0, rank: 0 });
    }
  }
  return ranks;
}
