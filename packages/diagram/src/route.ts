/**
 * Routes for a laid-out `layered` diagram.
 *
 * An edge running down the ranks leaves its source by the face toward the
 * next rank and arrives at its target's face toward the last, so it reads
 * along the direction the diagram flows. An edge that skips ranks gets
 * waypoints through the gaps in each rank it crosses, so it goes around the
 * nodes between its ends rather than through them.
 *
 * An edge running back up the ranks, or within one, is left to the ends'
 * facing rule.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { Graph } from './graph';
import { backEdges, ranksOf } from './layered';
import { axesFor, type LayoutDirection } from './layout';

type Rect = { x: number; y: number; width: number; height: number };

/** One edge to route, by the ids of its ends: a node's or a group's. */
export interface RouteEdge {
  id: string;
  from: string;
  to: string;
}

/** What {@link layeredRoutes} hands an edge. A field is absent where the
 *  default does as well. */
export interface LayeredRoute {
  fromPort?: string;
  toPort?: string;
  waypoints?: Vec2[];
}

export interface LayeredRouteInput {
  /** The graph layout ranked, for which rank each node is in. */
  graph: Graph;
  edges: readonly RouteEdge[];
  /** Every node and group box where it was placed. */
  boxes: ReadonlyMap<string, Rect>;
  /** Each group's node members, through nested groups. */
  members: ReadonlyMap<string, readonly string[]>;
  /** Ids whose ports are the four compass midpoints, which are the only ones
   *  a route names. */
  compass: ReadonlySet<string>;
  direction?: LayoutDirection;
  /** How far a route keeps from the boxes it passes. */
  clearance: number;
}

/** The compass port facing the next rank, and the one facing the last. */
const FACES: Record<LayoutDirection, { out: string; in: string }> = {
  down: { out: 's', in: 'n' },
  up: { out: 'n', in: 's' },
  right: { out: 'e', in: 'w' },
  left: { out: 'w', in: 'e' },
};

export function layeredRoutes(input: LayeredRouteInput): Map<string, LayeredRoute> {
  const { graph, boxes, members, compass, clearance } = input;
  const direction = input.direction ?? 'down';
  const axes = axesFor(direction);
  const faces = FACES[direction];
  const ranks = ranksOf(graph, backEdges(graph));

  const span = (id: string): [number, number] | null => {
    const ids = members.get(id) ?? [id];
    const rs = ids.map((m) => ranks.get(m)).filter((r): r is number => r !== undefined);
    return rs.length === 0 ? null : [Math.min(...rs), Math.max(...rs)];
  };
  const lo = (r: Rect, axis: 'x' | 'y') => (axis === 'x' ? r.x : r.y);
  const hi = (r: Rect, axis: 'x' | 'y') => (axis === 'x' ? r.x + r.width : r.y + r.height);
  const mid = (r: Rect, axis: 'x' | 'y') => (lo(r, axis) + hi(r, axis)) / 2;

  const byRank = new Map<number, Rect[]>();
  for (const node of graph.nodes) {
    const rank = ranks.get(node.id);
    const box = boxes.get(node.id);
    if (rank === undefined || box === undefined) continue;
    byRank.set(rank, [...(byRank.get(rank) ?? []), box]);
  }

  const routes = new Map<string, LayeredRoute>();
  for (const edge of input.edges) {
    const from = span(edge.from);
    const to = span(edge.to);
    const a = boxes.get(edge.from);
    const b = boxes.get(edge.to);
    // Ranks run along `direction` in rank number whichever way the world axis
    // points, so a forward edge is one whose target ranks past its source.
    if (from === null || to === null || a === undefined || b === undefined || from[1] >= to[0]) continue;
    const route: LayeredRoute = {};
    if (compass.has(edge.from)) route.fromPort = faces.out;
    if (compass.has(edge.to)) route.toPort = faces.in;

    const near = axes.sign === 1 ? hi : lo;
    const far = axes.sign === 1 ? lo : hi;
    const start = { cross: mid(a, axes.cross), rank: near(a, axes.rank) };
    const end = { cross: mid(b, axes.cross), rank: far(b, axes.rank) };
    const ends = new Set([edge.from, edge.to, ...(members.get(edge.from) ?? []), ...(members.get(edge.to) ?? [])]);
    // A group box an end sits in is one the edge has to cross.
    const groupsInWay = [...members].filter(([g, ms]) => !ends.has(g) && !ms.some((m) => ends.has(m)));

    const stops: { cross: number; rank: number }[] = [];
    let blocked = false;
    for (let k = from[1] + 1; k < to[0]; k++) {
      const row = byRank.get(k) ?? [];
      if (row.length === 0) continue;
      const bandLo = Math.min(...row.map((r) => lo(r, axes.rank)));
      const bandHi = Math.max(...row.map((r) => hi(r, axes.rank)));
      const obstacles = [...row];
      for (const [g] of groupsInWay) {
        const box = boxes.get(g);
        if (box !== undefined && lo(box, axes.rank) < bandHi && hi(box, axes.rank) > bandLo) obstacles.push(box);
      }
      const t = ((bandLo + bandHi) / 2 - start.rank) / (end.rank - start.rank);
      const ideal = start.cross + (end.cross - start.cross) * t;
      const cross = freeAt(ideal, obstacles.map((r) => [lo(r, axes.cross) - clearance, hi(r, axes.cross) + clearance]));
      if (cross !== ideal) blocked = true;
      const [first, last] = axes.sign === 1 ? [bandLo, bandHi] : [bandHi, bandLo];
      stops.push({ cross, rank: first }, { cross, rank: last });
    }
    if (blocked) {
      route.waypoints = stops.map((s) => (axes.rank === 'y' ? { x: s.cross, y: s.rank } : { x: s.rank, y: s.cross }));
    }
    if (route.fromPort !== undefined || route.toPort !== undefined || route.waypoints !== undefined) {
      routes.set(edge.id, route);
    }
  }
  return routes;
}

/** The point nearest `at` that lies in none of `spans`. Spans that only touch
 *  leave the point where they meet free. */
function freeAt(at: number, spans: readonly (readonly [number, number])[]): number {
  const sorted = [...spans].sort((p, q) => p[0] - q[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of sorted) {
    const top = merged[merged.length - 1];
    if (top !== undefined && s < top[1]) top[1] = Math.max(top[1], e);
    else merged.push([s, e]);
  }
  for (const [s, e] of merged) {
    if (at > s && at < e) return at - s <= e - at ? s : e;
  }
  return at;
}
