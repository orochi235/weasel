/**
 * How far group boxes reach past each rank's band along the rank axis.
 */
import { rankInset } from '../cluster';
import type { Graph, GraphNode } from '../graph';
import type { LayoutAxes } from '../layout';

/** For each rank, how far before its band (`lo`) and after it (`hi`) the
 *  boxes of the groups starting or ending there reach, nested boxes adding
 *  their insets to their parents'. */
export function boxReach(
  graph: Pick<Graph, 'groups'>,
  rows: readonly (readonly Pick<GraphNode, 'id'>[])[],
  axes: LayoutAxes,
): { lo: number[]; hi: number[] } {
  const lo = rows.map(() => 0);
  const hi = rows.map(() => 0);
  const groups = graph.groups ?? [];
  const byId = new Map(groups.map((g) => [g.id, g]));
  const rowOf = new Map<string, number>();
  rows.forEach((row, r) => row.forEach((n) => rowOf.set(n.id, r)));
  const span = new Map<string, [number, number]>();
  for (const g of groups) {
    const rs = g.members.map((m) => rowOf.get(m)).filter((r): r is number => r !== undefined);
    if (rs.length > 0) span.set(g.id, [Math.min(...rs), Math.max(...rs)]);
  }
  for (const g of groups) {
    const own = span.get(g.id);
    if (own === undefined) continue;
    for (const [side, out] of [[0, lo], [1, hi]] as const) {
      let reach = 0;
      for (let h = byId.get(g.id); h !== undefined; h = h.parent === undefined ? undefined : byId.get(h.parent)) {
        if (span.get(h.id)?.[side] !== own[side]) break;
        reach += rankInset(h.inset, axes)[side === 0 ? 'lo' : 'hi'];
      }
      out[own[side]] = Math.max(out[own[side]]!, reach);
    }
  }
  return { lo, hi };
}
