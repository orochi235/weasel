/**
 * Barycenter crossing reduction: each node moves to the mean position of its
 * neighbors in the adjacent rank, sweeping down then up a fixed number of
 * times. Ties keep the current order, so the result is a function of the
 * input order alone.
 */
import type { Graph, GraphNode } from './graph';

const SWEEPS = 4;

export function barycenterOrder(
  graph: Graph,
  rows: GraphNode[][],
  back: ReadonlySet<string>,
): GraphNode[][] {
  const out = rows.map((row) => [...row]);
  const index = new Map<string, number>();
  const reindex = (row: GraphNode[]) => row.forEach((n, i) => index.set(n.id, i));
  out.forEach(reindex);

  const reorder = (row: GraphNode[], neighbors: (id: string) => string[]) => {
    const key = new Map<string, number>();
    for (const [i, n] of row.entries()) {
      const at = neighbors(n.id).map((id) => index.get(id)).filter((v): v is number => v !== undefined);
      key.set(n.id, at.length === 0 ? i : at.reduce((s, v) => s + v, 0) / at.length);
    }
    row.sort((a, b) => key.get(a.id)! - key.get(b.id)! || index.get(a.id)! - index.get(b.id)!);
    reindex(row);
  };

  const ups = (id: string) => graph.incoming(id).filter((e) => !back.has(e.id)).map((e) => e.from);
  const downs = (id: string) => graph.outgoing(id).filter((e) => !back.has(e.id)).map((e) => e.to);
  for (let s = 0; s < SWEEPS; s++) {
    for (let r = 1; r < out.length; r++) reorder(out[r]!, ups);
    for (let r = out.length - 2; r >= 0; r--) reorder(out[r]!, downs);
  }
  return out;
}
