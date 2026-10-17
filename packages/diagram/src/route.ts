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
import type { Graph } from './graph';
import type { LayoutDirection, LayoutPorts } from './layout';
import { COMPASS, DEFAULT_PORTS } from './ports';
import type { PortSpec } from './types';

/** A compass point's port name. */
export type Compass = keyof typeof COMPASS;

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
  /** The point on the route layout left the edge's label room beside, as a
   *  `DiagramLabel`'s `{ near }`. */
  labelAt?: Vec2;
}

/** What {@link layeredRoutes} reads: where `layeredPlan` put things. */
export interface LayeredRouteInput {
  edges: readonly RouteEdge[];
  /** Each node's rank, from `layeredPlan`. Empty for a layout with none,
   *  which names no ports. */
  ranks: ReadonlyMap<string, number>;
  /** Each spanning edge's waypoints, from `layeredPlan`. */
  waypoints: ReadonlyMap<string, readonly Vec2[]>;
  /** Where each labeled edge's label room is among its waypoints, from
   *  `layeredPlan`. */
  labels?: ReadonlyMap<string, Vec2>;
  /** Each group's node members, through nested groups. */
  members: ReadonlyMap<string, readonly string[]>;
  /** Ids whose ports are the four compass midpoints, which are the only ones
   *  a route names. */
  compass: ReadonlySet<string>;
  direction?: LayoutDirection;
}

/** The compass port facing the next rank, and the one facing the last. */
export const FACES: Record<LayoutDirection, { out: Compass; in: Compass }> = {
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
    const route: LayeredRoute = {};
    // Ports face the next rank only for an edge between two ranks; a plan
    // with no ranks routes through its waypoints alone.
    if (from !== null && to !== null && (from[1] < to[0] || to[1] < from[0])) {
      const ahead = from[1] < to[0];
      if (compass.has(edge.from)) route.fromPort = ahead ? faces.out : faces.in;
      if (compass.has(edge.to)) route.toPort = ahead ? faces.in : faces.out;
    }
    const waypoints = input.waypoints.get(edge.id);
    if (waypoints !== undefined && waypoints.length > 0) {
      route.waypoints = waypoints;
      const label = input.labels?.get(edge.id);
      if (label !== undefined) route.labelAt = label;
    }
    if (route.fromPort !== undefined || route.toPort !== undefined || route.waypoints !== undefined) {
      routes.set(edge.id, route);
    }
  }
  return routes;
}

/**
 * The compass ports {@link layeredRoutes} names for each drawn edge of
 * `graph` that runs between ranks, keyed by the edge's id as drawn. A node
 * gets a face named only when it has a port by that name at that compass
 * point; a group always does.
 */
export function layeredPorts(
  graph: Graph,
  ranks: ReadonlyMap<string, number>,
  direction?: LayoutDirection,
): Map<string, LayoutPorts> {
  const faces = FACES[direction ?? 'down'];
  const compass = new Set<string>(graph.groups?.map((g) => g.id) ?? []);
  for (const node of graph.nodes) {
    if (hasCompassPort(node, faces.out) && hasCompassPort(node, faces.in)) compass.add(node.id);
  }
  const edges = new Map<string, RouteEdge>();
  for (const e of graph.edges) {
    const id = e.origin?.id ?? e.id;
    if (!edges.has(id)) edges.set(id, { id, from: e.origin?.from ?? e.from, to: e.origin?.to ?? e.to });
  }
  const routes = layeredRoutes({
    edges: [...edges.values()],
    ranks,
    waypoints: new Map(),
    members: new Map((graph.groups ?? []).map((g) => [g.id, g.members])),
    compass,
    ...(direction !== undefined ? { direction } : {}),
  });
  return new Map([...routes].map(([id, r]) => [id, {
    ...(r.fromPort !== undefined ? { from: r.fromPort } : {}),
    ...(r.toPort !== undefined ? { to: r.toPort } : {}),
  }]));
}

/** Whether `node` has a port named for compass point `face` and sitting at
 *  it, which is the only kind of port a layout names. */
export function hasCompassPort(node: { ports?: readonly PortSpec[] }, face: Compass): boolean {
  const point = COMPASS[face];
  return (node.ports ?? DEFAULT_PORTS).some((p) => p.id === face && p.at.u === point.u && p.at.v === point.v);
}

/** What a layout's plan says of each edge's route, as {@link authoredOver}
 *  reads it. */
export interface PlannedRoutes {
  ports?: ReadonlyMap<string, LayoutPorts>;
  waypoints?: ReadonlyMap<string, readonly Vec2[]>;
  labels?: ReadonlyMap<string, Vec2>;
}

/** Each edge's ports and waypoints: the author's where given, else the
 *  plan's. */
export function authoredOver(
  edges: readonly (RouteEdge & LayeredRoute)[],
  plan: PlannedRoutes,
): Map<string, LayeredRoute> {
  return new Map(edges.map((e) => {
    const ports = plan.ports?.get(e.id);
    const planned = plan.waypoints?.get(e.id);
    const fromPort = e.fromPort ?? ports?.from;
    const toPort = e.toPort ?? ports?.to;
    const waypoints = e.waypoints ?? (planned !== undefined && planned.length > 0 ? planned : undefined);
    // The room is beside layout's waypoints, not the author's.
    const labelAt = e.waypoints === undefined && waypoints !== undefined ? plan.labels?.get(e.id) : undefined;
    return [e.id, {
      ...(fromPort ? { fromPort } : {}),
      ...(toPort ? { toPort } : {}),
      ...(waypoints ? { waypoints } : {}),
      ...(labelAt !== undefined ? { labelAt } : {}),
    }];
  }));
}
