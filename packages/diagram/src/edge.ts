/**
 * `DiagramEdge` — a connection between two participants.
 *
 * An edge is an ordinary leaf scene node with `dependsOn: [from, to]` and a
 * `derivePath` that runs a **router**. Being a scene node rather than a
 * plugin-owned render layer buys selection, hit-testing, hover, styling,
 * z-order, SVG export, undo, and copy/paste. The cost is that an edge costs
 * what a node costs — right for tens to hundreds of edges, wrong for a
 * 10k-edge force graph.
 *
 * **Author-dragged waypoints are data on the edge and the router routes
 * through them**, so a moved endpoint still re-routes.
 *
 * Arrowheads are not here. They are stroke markers, the same
 * `markerStart` / `markerEnd` any other stroke carries.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  polylineFromPoints,
  type DerivedDep,
  type Path,
  type PoseDescriptor,
  type SceneRegistry,
  type Vec2,
} from '@weasel-js/core';
import { ANCHOR_DERIVE_POSE, DIAGRAM_ANCHOR, DIAGRAM_GROUP, GROUP_DERIVE_POSE } from './group';
import { CONTAINER_LAYOUTS } from './containers/layouts';
import { DIAGRAM_LABEL, LABEL_DERIVE_POSE } from './label';
import { portSitesOf, portsOf, type PortsOptions } from './ports';
import { selfLoop } from './selfLoop';
import { diagramEdgeOf, type EdgeEnd } from './edgeTrait';
import { ROUTERS, straight, type Router } from './routers';
import type { Port } from './types';

export { avoid, bezier, orthogonal, ROUTERS, straight } from './routers';
export type { RouteRequest, Router } from './routers';

/**
 * The port an end resolves to: the one it named, at whichever of its places
 * faces `toward` most directly, else the port facing `toward` most directly.
 *
 * "Facing" rather than "nearest": a port on the far side of a wide node can be
 * closer in a straight line than the one pointing at the target.
 */
export function resolveEnd<TPose>(
  end: EdgeEnd,
  dep: DerivedDep<TPose>,
  toward: Vec2,
  opts: PortsOptions<TPose>,
  allPorts: (d: DerivedDep<TPose>) => Port[],
): Port | undefined {
  if (end.port !== undefined) {
    const sites = portSitesOf(dep.node as never, dep.pose, end.port, opts);
    // A place counts only when it faces `toward` at all; else the port sits
    // at `at`, as a self-loop's does.
    const ahead = sites.filter((p) => p.normal !== null && p.normal.x * (toward.x - p.point.x) + p.normal.y * (toward.y - p.point.y) > 0);
    if (sites.length > 0) return ahead.length > 0 ? facing(ahead, toward) : sites[0];
  }
  return facing(allPorts(dep), toward);
}

/** The point an end aims at when it names none: the center of its bounds. */
export function boxCenter<TPose>(geometry: PoseDescriptor<TPose>, pose: TPose): Vec2 {
  const b = geometry.getBounds(pose);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * Where each end of an edge aims as it resolves: the nearest bend of its
 * stored route, else its nearest authored waypoint, else the other end's
 * center. Centers are stable while both ends resolve; aiming at the other
 * *port* would be circular.
 */
export function endAims(
  fromCenter: Vec2,
  toCenter: Vec2,
  waypoints: readonly Vec2[],
  route: readonly Vec2[] = [],
): { from: Vec2; to: Vec2 } {
  return {
    from: route[0] ?? waypoints[0] ?? toCenter,
    to: route[route.length - 1] ?? waypoints[waypoints.length - 1] ?? fromCenter,
  };
}

/** The port pointing at `toward` most directly, tie-broken toward the closer. */
function facing(ports: readonly Port[], toward: Vec2): Port | undefined {
  let best: Port | undefined;
  let bestScore = -Infinity;
  for (const port of ports) {
    const dx = toward.x - port.point.x;
    const dy = toward.y - port.point.y;
    const len = Math.hypot(dx, dy) || 1;
    // Alignment with the port's own facing, tie-broken toward the closer port.
    const aim = port.normal === null
      ? 0
      : (port.normal.x * dx + port.normal.y * dy) / len;
    const score = aim - len / 1e6;
    if (score > bestScore) {
      bestScore = score;
      best = port;
    }
  }
  return best;
}

/** The router an edge is drawn with: the one it names, else `straight`. */
export function routerOf(edge: { router?: string }, routers: Readonly<Record<string, Router>> = ROUTERS): Router {
  return (edge.router !== undefined && routers[edge.router]) || straight;
}

/** Options for {@link edgeDerivePath}. */
export interface EdgeRouteOptions<TPose> extends PortsOptions<TPose> {
  /** Routers by key. Defaults to {@link ROUTERS}. */
  routers?: Readonly<Record<string, Router>>;
  /** How far outside its node a self-edge with no ports named turns, in
   *  world units. Defaults to half the node's shorter side. */
  selfLoopStandoff?: number;
}

/**
 * A `derivePath` that routes an edge between its two dependencies.
 *
 * An edge from a node to itself that names no ports leaves and returns by the
 * sides {@link selfLoop} picks, and where the author set no waypoints the
 * router is handed that rule's point outside the node as one.
 *
 * Returns `null` — nothing to draw — when the node is not an edge, when either
 * dependency is gone, or when an endpoint offers no ports at all.
 */
export function edgeDerivePath<TPose>(
  opts: EdgeRouteOptions<TPose> = {},
): (node: { data: unknown }, deps: readonly (DerivedDep<TPose> | undefined)[]) => Path | null {
  const routeOf = edgeRouter(opts);
  return (node, deps) => {
    const points = routeOf(node, deps)?.points;
    return points === undefined || points.length < 2 ? null : polylineFromPoints(points as { x: number; y: number }[]);
  };
}

/** An edge's route as {@link edgeDerivePath} draws it, before it becomes a path. */
export interface ResolvedRoute {
  /** The two ends, resolved. */
  from: Port;
  to: Port;
  /** What the router was handed between them: the author's waypoints, or a
   *  self-loop's turning point. */
  waypoints: readonly Vec2[];
  /** The router's answer, `from.point` first and `to.point` last. */
  points: readonly Vec2[];
}

/** Routes an edge between its two dependencies the way {@link edgeDerivePath}
 *  does, answering the route itself; null where that draws nothing. */
export function edgeRouter<TPose>(
  opts: EdgeRouteOptions<TPose> = {},
): (node: { data: unknown }, deps: readonly (DerivedDep<TPose> | undefined)[]) => ResolvedRoute | null {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  const portOpts: PortsOptions<TPose> = { geometry, ...(opts.read ? { read: opts.read } : {}) };
  const allPorts = (d: DerivedDep<TPose>): Port[] =>
    portsOf(d.node as never, d.pose, portOpts);
  const standoffOf = (d: DerivedDep<TPose>): number => {
    const b = geometry.getBounds(d.pose);
    return Math.min(b.width, b.height) / 2;
  };

  return (node, deps) => {
    const edge = diagramEdgeOf(node);
    if (edge === null) return null;
    const [fromDep, toDep] = deps;
    if (fromDep === undefined || toDep === undefined) return null;

    const loop = fromDep.node.id === toDep.node.id && edge.from.port === undefined && edge.to.port === undefined
      ? selfLoop(allPorts(fromDep), opts.selfLoopStandoff ?? standoffOf(fromDep))
      : null;
    const authored = edge.waypoints ?? [];
    const aims = endAims(boxCenter(geometry, fromDep.pose), boxCenter(geometry, toDep.pose), authored, edge.route);
    const from = loop?.from ?? resolveEnd(edge.from, fromDep, aims.from, portOpts, allPorts);
    const to = loop?.to ?? resolveEnd(edge.to, toDep, aims.to, portOpts, allPorts);
    if (from === undefined || to === undefined) return null;

    const waypoints = loop !== null && authored.length === 0 ? [loop.via] : authored;
    return { from, to, waypoints, points: routerOf(edge, opts.routers)({ from, to, waypoints, route: edge.route }) };
  };
}

/** Registry key for {@link EDGE_DERIVE_PATH}. */
export const DIAGRAM_EDGE = 'diagram:edge';

/** The default edge router, as one stable function reference so `toJSON` can
 *  find its key. A consumer wanting different options registers their own
 *  `edgeDerivePath(...)` under a key of their choosing. */
export const EDGE_DERIVE_PATH = edgeDerivePath<unknown>();

/** Merge this package's registry entries under a consumer's, so an edge
 *  round-trips through `toJSON` without the consumer wiring the key. */
export function withDiagramRegistry<TPose, TData = unknown, TLayer extends string = string>(
  registry: SceneRegistry<TPose, TData, TLayer> = {},
): SceneRegistry<TPose, TData, TLayer> {
  return {
    ...registry,
    derivePath: {
      [DIAGRAM_EDGE]: EDGE_DERIVE_PATH,
      ...registry.derivePath,
    },
    derivePose: {
      [DIAGRAM_LABEL]: LABEL_DERIVE_POSE as NonNullable<SceneRegistry<TPose, TData, TLayer>['derivePose']>[string],
      [DIAGRAM_GROUP]: GROUP_DERIVE_POSE as NonNullable<SceneRegistry<TPose, TData, TLayer>['derivePose']>[string],
      [DIAGRAM_ANCHOR]: ANCHOR_DERIVE_POSE as NonNullable<SceneRegistry<TPose, TData, TLayer>['derivePose']>[string],
      ...registry.derivePose,
    },
    layout: {
      ...(CONTAINER_LAYOUTS as unknown as NonNullable<SceneRegistry<TPose, TData, TLayer>['layout']>),
      ...registry.layout,
    },
  };
}
