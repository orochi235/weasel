/**
 * Routes for `chain`'s side edges: each edge between a chain node and a node
 * hung one step out from it runs through a track of its own in the gap
 * between them, so a fan of them into one node's ports never crosses itself.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { Graph, GraphEdge, GraphNode } from './graph';
import type { LayoutAxes, LayoutResult } from './layout';

/** Which chain node each node hangs on, and how many steps out. */
export interface Hanging {
  owner: ReadonlyMap<string, string>;
  level: ReadonlyMap<string, number>;
}

/** One side edge, in the frame of the line: positions along it (`rank`) and
 *  across it (`cross`). */
interface Side {
  edge: GraphEdge;
  /** Whether the edge's `from` end is the chain node. */
  lineFirst: boolean;
  port: number;
  hung: number;
  /** Across the line, where the chain node's port sits and where the hung node's does. */
  lineEdge: number;
  hungEdge: number;
}

const portOf = (node: GraphNode, id: string | undefined) => (id === undefined ? undefined : node.ports?.find((p) => p.id === id));

/** A port's place along `axis` within `bounds` at `at`. */
function coord(node: GraphNode, at: Vec2, id: string | undefined, axis: 'x' | 'y'): { along: number; anchor: number } | undefined {
  const spec = portOf(node, id);
  if (spec === undefined) return undefined;
  const anchor = axis === 'x' ? spec.at.u : spec.at.v;
  return { along: (axis === 'x' ? at.x : at.y) + anchor * (axis === 'x' ? node.bounds.width : node.bounds.height), anchor };
}

/** The side edges of the graph, where both ends name ports on the edges of
 *  their nodes that face each other. */
function sidesOf(graph: Graph, hanging: Hanging, moves: LayoutResult, axes: LayoutAxes, before: boolean): Map<string, Side[]> {
  const at = (node: GraphNode): Vec2 => moves.get(node.id) ?? node.bounds;
  const byLine = new Map<string, Side[]>();
  for (const edge of graph.edges) {
    const lineFirst = hanging.level.get(edge.from) === 0;
    const [lineId, hungId] = lineFirst ? [edge.from, edge.to] : [edge.to, edge.from];
    if (hanging.level.get(lineId) !== 0 || hanging.level.get(hungId) !== 1 || hanging.owner.get(hungId) !== lineId) continue;
    const line = graph.node(lineId)!;
    const hung = graph.node(hungId)!;
    const [linePort, hungPort] = lineFirst ? [edge.fromPort, edge.toPort] : [edge.toPort, edge.fromPort];
    const lineCross = coord(line, at(line), linePort, axes.cross);
    const hungCross = coord(hung, at(hung), hungPort, axes.cross);
    if (lineCross?.anchor !== (before ? 0 : 1) || hungCross?.anchor !== (before ? 1 : 0)) continue;
    const side: Side = {
      edge, lineFirst,
      port: coord(line, at(line), linePort, axes.rank)!.along,
      hung: coord(hung, at(hung), hungPort, axes.rank)!.along,
      lineEdge: lineCross.along,
      hungEdge: hungCross.along,
    };
    const list = byLine.get(lineId);
    if (list === undefined) byLine.set(lineId, [side]);
    else list.push(side);
  }
  return byLine;
}

/** The least room between two side tracks, and between a track and the edge
 *  of either node it runs beside. A turn onto a track rounds within that room,
 *  so this is also the tightest corner radius: six widths of a 2px edge. */
export const SIDE_TRACK_GAP = 12;

/** A chain node's sideways side edges, split by which way they turn, each set
 *  in the order its tracks take outward from the line. */
function turning(sides: readonly Side[]): [Side[], Side[]] {
  const sideways = sides.filter((s) => Math.abs(s.hung - s.port) > 0.5);
  return [
    sideways.filter((s) => s.hung < s.port).sort((a, b) => a.port - b.port),
    sideways.filter((s) => s.hung > s.port).sort((a, b) => b.port - a.port),
  ];
}

/** The most tracks any chain node's side edges need. */
export function tracksNeeded(graph: Graph, hanging: Hanging, moves: LayoutResult, axes: LayoutAxes, before: boolean): number {
  let most = 0;
  for (const sides of sidesOf(graph, hanging, moves, axes, before).values()) {
    const [low, high] = turning(sides);
    most = Math.max(most, low.length, high.length);
  }
  return most;
}

/**
 * The waypoints of every side edge that has to run sideways to reach its port.
 *
 * Edges whose hung end lies toward lower rank than their port turn at tracks
 * nearer the line the lower their port sits, and the others the reverse, so
 * no edge's run crosses another's climb. The two sets never overlap along the
 * line once the hung nodes stand in their ports' order, so they share tracks.
 */
export function sideRoutes(
  graph: Graph,
  hanging: Hanging,
  moves: LayoutResult,
  axes: LayoutAxes,
  before: boolean,
): Map<string, Vec2[]> {
  const out = new Map<string, Vec2[]>();
  for (const sides of sidesOf(graph, hanging, moves, axes, before).values()) {
    const [low, high] = turning(sides);
    const lineEdge = sides[0]!.lineEdge;
    const hungEdge = before ? Math.max(...sides.map((s) => s.hungEdge)) : Math.min(...sides.map((s) => s.hungEdge));
    const step = (hungEdge - lineEdge) / (Math.max(low.length, high.length) + 1);
    for (const run of [low, high]) {
      run.forEach((s, k) => {
        const track = lineEdge + step * (k + 1);
        const dir = Math.sign(s.hung - s.port);
        const half = Math.abs(s.hung - s.port) / 2;
        const turns = [
          { rank: s.port + dir * Math.min(Math.abs(track - s.lineEdge), half), cross: track },
          { rank: s.hung - dir * Math.min(Math.abs(s.hungEdge - track), half), cross: track },
        ];
        const points = turns.map((t) => (axes.rank === 'x' ? { x: t.rank, y: t.cross } : { x: t.cross, y: t.rank }));
        out.set(s.edge.id, s.lineFirst ? points : points.reverse());
      });
    }
  }
  return out;
}

/** The order along the line of the nodes hung one step out from `lineId`:
 *  by where the ports they meet sit on it. A node meeting no port keeps its place. */
export function inPortOrder(graph: Graph, lineId: string, row: readonly GraphNode[], axes: LayoutAxes): GraphNode[] {
  const line = graph.node(lineId)!;
  const keyOf = (node: GraphNode): number | undefined => {
    const anchors = [...graph.outgoing(node.id).filter((e) => e.to === lineId).map((e) => e.toPort),
      ...graph.incoming(node.id).filter((e) => e.from === lineId).map((e) => e.fromPort)]
      .flatMap((id) => {
        const spec = portOf(line, id);
        return spec === undefined ? [] : [axes.rank === 'x' ? spec.at.u : spec.at.v];
      });
    return anchors.length === 0 ? undefined : (axes.sign * anchors.reduce((a, b) => a + b, 0)) / anchors.length;
  };
  const keyed = row.map((node) => ({ node, key: keyOf(node) }));
  const slots = keyed.flatMap((k, i) => (k.key === undefined ? [] : [i]));
  const sorted = keyed.filter((k) => k.key !== undefined).sort((a, b) => a.key! - b.key!);
  const out = [...row];
  slots.forEach((i, j) => { out[i] = sorted[j]!.node; });
  return out;
}
