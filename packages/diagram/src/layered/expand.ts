/**
 * Placeholders: a node standing in for an edge in each rank it crosses, so
 * ordering counts its crossings and placement leaves it room.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { EdgeLabelRoom, Graph, GraphEdge, GraphNode } from '../graph';
import { portSitesOf } from '../ports';
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
  /** Indexes of the rows that hold labels rather than nodes. */
  labelRows: ReadonlySet<number>;
  /** For each labeled edge given room, the placeholder its label sits beside. */
  labels: ReadonlyMap<string, string>;
  /** Where a wire runs across its placeholder, from the placeholder's low
   *  corner; absent where that is its middle. */
  wires: ReadonlyMap<string, number>;
}

/** Options for {@link expand}. */
export interface ExpandOptions {
  axes: LayoutAxes;
  nodeGap: number;
}

/** One drawn edge, its ends as drawn: a node or a group, either way round
 *  for an edge layout turned around. */
interface Drawn {
  id: string;
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
  label?: EdgeLabelRoom;
  waypoints?: readonly Vec2[];
  authored?: boolean;
  back: boolean;
}

/** Each node's row once label rows are added, and the row each labeled edge's
 *  label takes: the gap nearest its middle, the earlier of two. */
function labelRowsOf(
  drawn: readonly Drawn[],
  ranks: ReadonlyMap<string, number>,
  span: (id: string, ranks: ReadonlyMap<string, number>) => [number, number] | null,
): { rows: Map<string, number>; labelRow: Map<string, number> } {
  const gapOf = new Map<string, number>();
  for (const d of drawn) {
    if (d.label === undefined) continue;
    const a = span(d.back ? d.to : d.from, ranks);
    const b = span(d.back ? d.from : d.to, ranks);
    if (a === null || b === null || a[1] >= b[0]) continue;
    gapOf.set(d.id, a[1] + Math.floor((b[0] - a[1] - 1) / 2));
  }
  const gaps = [...new Set(gapOf.values())];
  const rowOf = (r: number) => r + gaps.filter((g) => g < r).length;
  const rows = new Map([...ranks].map(([id, r]) => [id, rowOf(r)]));
  return { rows, labelRow: new Map([...gapOf].map(([id, g]) => [id, rowOf(g) + 1])) };
}

/**
 * A label's placeholder: its extent across the rank and where its wire runs
 * across it. The label sits `offset` beyond the wire on the side the label's
 * `offset` names, left of travel; a placeholder's usual half-width stays on
 * the wire's other side. With no offset the wire runs through the middle.
 */
function labelRoom(room: EdgeLabelRoom, axes: LayoutAxes, back: boolean, nodeGap: number): { size: number; depth: number; wire: number } {
  const across = extent({ x: 0, y: 0, width: room.width, height: room.height }, axes.cross);
  const depth = extent({ x: 0, y: 0, width: room.width, height: room.height }, axes.rank);
  const offset = room.offset ?? 0;
  if (offset === 0) return { size: across, depth, wire: across / 2 };
  // Left of travel, read along the cross axis: with y down, a wire running
  // down has its left toward +x, and one running right has it toward -y.
  const left = (axes.rank === 'y' ? 1 : -1) * axes.sign * (back ? -1 : 1);
  const margin = nodeGap / 4;
  const size = margin + Math.abs(offset) + across;
  return { size, depth, wire: left * Math.sign(offset) > 0 ? margin : size - margin };
}

const MIDDLE: readonly number[] = [0.5];

/**
 * Every place a port may sit, as `Hop.fromAt` reads one: along its node's
 * extent across the rank, 0 to 1, where `portsOf` puts it, on the node's
 * outline. No port named, or none by that name, is the middle.
 */
export function portPlaces(node: GraphNode | undefined, port: string | undefined, axes: LayoutAxes): readonly number[] {
  if (node === undefined || port === undefined) return MIDDLE;
  const { bounds } = node;
  const trait = { ...(node.ports !== undefined ? { ports: node.ports } : {}), ...(node.outline !== undefined ? { outline: node.outline } : {}) };
  const sites = portSitesOf({ id: node.id, kind: 'mark', data: null }, bounds, port, { read: () => trait });
  const size = extent(bounds, axes.cross);
  if (sites.length === 0 || size <= 0) return MIDDLE;
  const low = axes.cross === 'x' ? bounds.x : bounds.y;
  return sites.map((p) => (p.point[axes.cross] - low) / size);
}

/** A hop end's port as a `Hop` carries it: its first place, and every place
 *  when it has more than one. */
function portOf(places: readonly number[], side: 'from' | 'to'): Partial<Hop> {
  const at = places[0]!;
  if (side === 'from') return places.length > 1 ? { fromAt: at, fromPlaces: places } : { fromAt: at };
  return places.length > 1 ? { toAt: at, toPlaces: places } : { toAt: at };
}

/**
 * Rows in seeded order, hops between adjacent ranks, and placeholder chains.
 *
 * An edge to or from a group runs between the group's members in its first or
 * last rank and the other end, with placeholders only in the ranks strictly
 * between the group's span and that end.
 */
export function expand(graph: Graph, nodeRanks: ReadonlyMap<string, number>, back: ReadonlySet<string>, opts: ExpandOptions): Expanded {
  const { axes } = opts;
  const groups = new Map((graph.groups ?? []).map((g) => [g.id, g]));
  const spanIn = (id: string, ranks: ReadonlyMap<string, number>): [number, number] | null => {
    const ids = groups.get(id)?.members ?? [id];
    const rs = ids.map((m) => ranks.get(m)).filter((r): r is number => r !== undefined);
    return rs.length === 0 ? null : [Math.min(...rs), Math.max(...rs)];
  };
  const drawn = drawnEdges(graph.edges, back);
  const labeled = labelRowsOf(drawn, nodeRanks, spanIn);
  const ranks = labeled.rows;
  const span = (id: string) => spanIn(id, ranks);
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
  const labels = new Map<string, string>();
  const wires = new Map<string, number>();
  for (const d of drawn) {
    const [from, to] = d.back ? [d.to, d.from] : [d.from, d.to];
    const [fromPort, toPort] = d.back ? [d.toPort, d.fromPort] : [d.fromPort, d.toPort];
    // A group end's members have no port of the edge's own.
    const leave = (id: string) => (id === from ? portOf(portPlaces(graph.node(id), fromPort, axes), 'from') : {});
    const arrive = (id: string) => (id === to ? portOf(portPlaces(graph.node(id), toPort, axes), 'to') : {});
    const a = span(from);
    const b = span(to);
    if (a === null || b === null || a[1] >= b[0]) continue;
    // Its route goes where its author put it, and no seed from it would
    // follow where this run puts the ranks it crosses.
    if (d.authored && b[0] - a[1] > 1) continue;
    const group = sharedGroup(from, to);
    const start = crossCenter(from);
    const end = crossCenter(to);
    const crossings = b[0] - a[1] - 1;
    // Where the route crosses each rank now, two waypoints a rank, read from
    // its `from` end as drawn; only a route with exactly that many says.
    const now = d.waypoints?.length === crossings * 2 ? d.waypoints : undefined;
    const seed = (j: number): number => {
      if (now !== undefined) return now[(d.back ? crossings - 1 - j : j) * 2]![axes.cross];
      return start + ((end - start) * (j + 1)) / (crossings + 1);
    };
    const labelRow = labeled.labelRow.get(d.id);
    let prev = inRank(from, a[1]);
    let prevAt: { fromAt: number } | null = null;
    const chain: string[] = [];
    for (let r = a[1] + 1; r < b[0]; r++) {
      const id = `${PLACEHOLDER}${d.id}:${r}`;
      const room = r === labelRow && d.label !== undefined
        ? labelRoom(d.label, axes, d.back, opts.nodeGap)
        : { size: opts.nodeGap / 2, depth: 0, wire: opts.nodeGap / 4 };
      const at = seed(r - a[1] - 1) - room.wire;
      const bounds = axes.cross === 'x'
        ? { x: at, y: 0, width: room.size, height: room.depth }
        : { x: 0, y: at, width: room.depth, height: room.size };
      add(r, { id, bounds, pinned: false, ...(group !== undefined ? { group } : {}) });
      const toAt = room.wire / room.size;
      for (const p of prev) hops.push({ from: p, to: id, edge: d.id, ...(prevAt ?? leave(p)), toAt });
      if (r === labelRow) {
        labels.set(d.id, id);
        wires.set(id, room.wire);
      }
      prev = [id];
      prevAt = { fromAt: toAt };
      chain.push(id);
    }
    for (const p of prev) for (const q of inRank(to, b[0])) hops.push({ from: p, to: q, edge: d.id, ...(prevAt ?? leave(p)), ...arrive(q) });
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
  return { rows, hops: dedupe(hops), chains, labelRows: new Set(labeled.labelRow.values()), labels, wires };
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
      ...(e.label !== undefined ? { label: e.label } : {}),
      ...(e.waypoints !== undefined ? { waypoints: e.waypoints } : {}),
      ...(e.authored ? { authored: true } : {}),
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
