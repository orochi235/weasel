/**
 * Placeholders: a node standing in for an edge in each rank it crosses, so
 * ordering counts its crossings and placement leaves it room.
 */
import type { Graph, GraphEdge, GraphNode } from '../graph';
import { DEFAULT_PORTS } from '../ports';
import { center, extent, graphOrder, seededOrder, type LayoutAxes } from '../layout';
import { PLACEHOLDER, type Hop, type Rows } from './types';

/** The ranks with placeholders added, the hops joining adjacent ranks, and
 *  each drawn edge's placeholders from its `from` end to its `to` end, with
 *  whether layout turned the edge around. */
export interface Expanded {
  rows: Rows;
  hops: Hop[];
  /** `ends` is every node the edge starts or ends at: its two ends, or a
   *  group end's members. */
  chains: Map<string, { ids: string[]; back: boolean; ends: string[] }>;
}

/** Options for {@link expand}. */
export interface ExpandOptions {
  axes: LayoutAxes;
  nodeGap: number;
  /** Add placeholders. Without them an edge spanning ranks adds no hops. */
  placeholders: boolean;
}

/** One drawn edge, its ends as drawn: a node or a group, either way round
 *  for an edge layout turned around. */
interface Drawn {
  id: string;
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
  back: boolean;
}

/**
 * Where a port sits along its node's extent across the rank, 0 to 1. A port
 * with several places counts at their mean, since the route picks among them
 * only once everything is placed; no port named is the middle.
 */
export function portAt(node: GraphNode | undefined, port: string | undefined, axis: 'x' | 'y'): number {
  if (node === undefined || port === undefined) return 0.5;
  const spec = (node.ports ?? DEFAULT_PORTS).find((p) => p.id === port);
  if (spec === undefined) return 0.5;
  const places = [spec.at, ...(spec.sites ?? [])];
  return places.reduce((sum, at) => sum + (axis === 'x' ? at.u : at.v), 0) / places.length;
}

/**
 * Rows in seeded order, hops between adjacent ranks, and placeholder chains.
 *
 * An edge to or from a group runs between the group's members in its first or
 * last rank and the other end, with placeholders only in the ranks strictly
 * between the group's span and that end.
 */
export function expand(graph: Graph, ranks: ReadonlyMap<string, number>, back: ReadonlySet<string>, opts: ExpandOptions): Expanded {
  const { axes } = opts;
  const groups = new Map((graph.groups ?? []).map((g) => [g.id, g]));
  const span = (id: string): [number, number] | null => {
    const ids = groups.get(id)?.members ?? [id];
    const rs = ids.map((m) => ranks.get(m)).filter((r): r is number => r !== undefined);
    return rs.length === 0 ? null : [Math.min(...rs), Math.max(...rs)];
  };
  const inRank = (id: string, r: number): string[] =>
    (groups.get(id)?.members ?? [id]).filter((m) => ranks.get(m) === r && graph.node(m) !== undefined);
  const ancestry = (id: string): string[] => {
    const out: string[] = [];
    let at = groups.has(id) ? groups.get(id)!.parent : graph.node(id)?.group;
    while (at !== undefined) {
      out.push(at);
      at = groups.get(at)?.parent;
    }
    return out;
  };
  const sharedGroup = (a: string, b: string): string | undefined => {
    const up = new Set(ancestry(b));
    return ancestry(a).find((g) => up.has(g));
  };
  const crossCenter = (id: string): number => {
    const node = graph.node(id);
    if (node !== undefined) return center(node.bounds, axes.cross);
    const ms = (groups.get(id)?.members ?? []).map((m) => graph.node(m)).filter((n): n is GraphNode => n !== undefined);
    return ms.length === 0 ? 0 : ms.reduce((s, n) => s + center(n.bounds, axes.cross), 0) / ms.length;
  };

  const byRank = new Map<number, GraphNode[]>();
  const add = (r: number, n: GraphNode) => byRank.set(r, [...(byRank.get(r) ?? []), n]);
  for (const node of graph.nodes) add(ranks.get(node.id) ?? 0, node);

  const hops: Hop[] = [];
  const chains: Expanded['chains'] = new Map();
  for (const d of drawnEdges(graph.edges, back)) {
    const [from, to] = d.back ? [d.to, d.from] : [d.from, d.to];
    const [fromPort, toPort] = d.back ? [d.toPort, d.fromPort] : [d.fromPort, d.toPort];
    // A group end's members have no port of the edge's own.
    const leave = (id: string) => (id === from ? { fromAt: portAt(graph.node(id), fromPort, axes.cross) } : {});
    const arrive = (id: string) => (id === to ? { toAt: portAt(graph.node(id), toPort, axes.cross) } : {});
    const a = span(from);
    const b = span(to);
    if (a === null || b === null || a[1] >= b[0]) continue;
    if (!opts.placeholders && b[0] - a[1] > 1) continue;
    const group = sharedGroup(from, to);
    const start = crossCenter(from);
    const end = crossCenter(to);
    let prev = inRank(from, a[1]);
    const chain: string[] = [];
    for (let r = a[1] + 1; r < b[0]; r++) {
      const id = `${PLACEHOLDER}${d.id}:${r}`;
      const width = opts.nodeGap / 2;
      const at = start + ((end - start) * (r - a[1])) / (b[0] - a[1]) - width / 2;
      const bounds = axes.cross === 'x' ? { x: at, y: 0, width, height: 0 } : { x: 0, y: at, width: 0, height: width };
      add(r, { id, bounds, pinned: false, ...(group !== undefined ? { group } : {}) });
      for (const p of prev) hops.push({ from: p, to: id, edge: d.id, ...leave(p) });
      prev = [id];
      chain.push(id);
    }
    for (const p of prev) for (const q of inRank(to, b[0])) hops.push({ from: p, to: q, edge: d.id, ...leave(p), ...arrive(q) });
    if (chain.length > 0) {
      const ends = [...(groups.get(from)?.members ?? [from]), ...(groups.get(to)?.members ?? [to])];
      chains.set(d.id, { ids: d.back ? chain.reverse() : chain, back: d.back, ends });
    }
  }

  const order = graphOrder(graph);
  const top = Math.max(-1, ...byRank.keys());
  const rows: Rows = [];
  for (let r = 0; r <= top; r++) {
    const row = byRank.get(r) ?? [];
    // A placeholder is not in the graph, so it ties after every node.
    rows.push(seededOrder(row, axes.cross, order));
  }
  return { rows, hops: dedupe(hops), chains };
}

/** Each drawn edge once: the stand-ins `expandGroupEdges` made for one edge to
 *  or from a group fold back into it. Self-loops draw no hops. */
function drawnEdges(edges: readonly GraphEdge[], back: ReadonlySet<string>): Drawn[] {
  const seen = new Map<string, Drawn>();
  for (const e of edges) {
    const id = e.origin?.id ?? e.id;
    if (seen.has(id)) continue;
    const from = e.origin?.from ?? e.from;
    const to = e.origin?.to ?? e.to;
    if (from === to) continue;
    seen.set(id, {
      id,
      from,
      to,
      ...(e.fromPort !== undefined ? { fromPort: e.fromPort } : {}),
      ...(e.toPort !== undefined ? { toPort: e.toPort } : {}),
      back: back.has(e.id),
    });
  }
  return [...seen.values()];
}

function dedupe(hops: readonly Hop[]): Hop[] {
  const seen = new Set<string>();
  return hops.filter((h) => {
    const key = `${h.from}\u0000${h.to}\u0000${h.edge}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A rank's extent along the rank axis: its deepest member's. */
export function depthOf(row: readonly GraphNode[], axes: LayoutAxes): number {
  return Math.max(0, ...row.map((n) => extent(n.bounds, axes.rank)));
}
