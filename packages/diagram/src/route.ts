/**
 * Routes for a laid-out `layered` diagram.
 *
 * An edge running down the ranks leaves its source by the face toward the
 * next rank and arrives at its target's face toward the last, so it reads
 * along the direction the diagram flows; one running back up the ranks does
 * the same the other way round. An edge that spans ranks runs through the
 * waypoints `layeredPlan` placed for it.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { LayoutDirection } from './layout';

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
  waypoints?: readonly Vec2[];
}

/** What {@link layeredRoutes} reads: where `layeredPlan` put things. */
export interface LayeredRouteInput {
  edges: readonly RouteEdge[];
  /** Each node's rank, from `layeredPlan`. */
  ranks: ReadonlyMap<string, number>;
  /** Each spanning edge's waypoints, from `layeredPlan`. */
  waypoints: ReadonlyMap<string, readonly Vec2[]>;
  /** Each group's node members, through nested groups. */
  members: ReadonlyMap<string, readonly string[]>;
  /** Ids whose ports are the four compass midpoints, which are the only ones
   *  a route names. */
  compass: ReadonlySet<string>;
  direction?: LayoutDirection;
}

/** The compass port facing the next rank, and the one facing the last. */
const FACES: Record<LayoutDirection, { out: string; in: string }> = {
  down: { out: 's', in: 'n' },
  up: { out: 'n', in: 's' },
  right: { out: 'e', in: 'w' },
  left: { out: 'w', in: 'e' },
};

/** Ports and waypoints for each edge of a laid-out `layered` diagram that
 *  needs any, keyed by edge id. */
export function layeredRoutes(input: LayeredRouteInput): Map<string, LayeredRoute> {
  const { ranks, members, compass } = input;
  const faces = FACES[input.direction ?? 'down'];
  const span = (id: string): [number, number] | null => {
    const rs = (members.get(id) ?? [id]).map((m) => ranks.get(m)).filter((r): r is number => r !== undefined);
    return rs.length === 0 ? null : [Math.min(...rs), Math.max(...rs)];
  };

  const routes = new Map<string, LayeredRoute>();
  for (const edge of input.edges) {
    const from = span(edge.from);
    const to = span(edge.to);
    if (from === null || to === null) continue;
    const ahead = from[1] < to[0];
    if (!ahead && to[1] >= from[0]) continue;
    const route: LayeredRoute = {};
    if (compass.has(edge.from)) route.fromPort = ahead ? faces.out : faces.in;
    if (compass.has(edge.to)) route.toPort = ahead ? faces.in : faces.out;
    const waypoints = input.waypoints.get(edge.id);
    if (waypoints !== undefined && waypoints.length > 0) route.waypoints = waypoints;
    if (route.fromPort !== undefined || route.toPort !== undefined || route.waypoints !== undefined) {
      routes.set(edge.id, route);
    }
  }
  return routes;
}

/** Each edge's ports and waypoints: the author's where given, else
 *  {@link layeredRoutes}'. */
export function authoredOver(
  edges: readonly (RouteEdge & LayeredRoute)[],
  input: Omit<LayeredRouteInput, 'edges'>,
): Map<string, LayeredRoute> {
  const routes = layeredRoutes({ ...input, edges });
  return new Map(edges.map((e) => {
    const r = routes.get(e.id);
    const fromPort = e.fromPort ?? r?.fromPort;
    const toPort = e.toPort ?? r?.toPort;
    const waypoints = e.waypoints ?? r?.waypoints;
    return [e.id, { ...(fromPort ? { fromPort } : {}), ...(toPort ? { toPort } : {}), ...(waypoints ? { waypoints } : {}) }];
  }));
}
