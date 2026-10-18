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
import { portCurvePoints } from '@weasel-js/geom';
import { ANCHOR_DERIVE_POSE, DIAGRAM_ANCHOR, DIAGRAM_GROUP, GROUP_DERIVE_POSE } from './group';
import { DIAGRAM_LABEL, LABEL_DERIVE_POSE } from './label';
import { portSitesOf, portsOf, type PortsOptions } from './ports';
import { selfLoop } from './selfLoop';
import { diagramEdgeOf, type EdgeEnd } from './edgeTrait';
import type { Port } from './types';

/** What a router is given: the two resolved ends, and the author's waypoints
 *  between them. */
export interface RouteRequest {
  from: Port;
  to: Port;
  waypoints: readonly Vec2[];
}

/** A router returns the points the edge runs through, `from.point` first and
 *  `to.point` last. */
export type Router = (req: RouteRequest) => readonly Vec2[];

/** The straight run between the two ends, through any waypoints. */
export const straight: Router = (req) => [req.from.point, ...req.waypoints, req.to.point];

/**
 * An axis-aligned route: leave along the departing end's normal and arrive
 * against the receiving one's.
 *
 * A leg is one elbow where the two ends face different axes and two where they
 * face the same one, turning at the midpoint of the axis they share. Arriving
 * along the port's own facing is what makes the arrowhead point *into* the
 * shape.
 */
export const orthogonal: Router = (req) => {
  const stops = [req.from.point, ...req.waypoints, req.to.point];
  const out: Vec2[] = [stops[0]!];
  for (let i = 1; i < stops.length; i++) {
    const a = out[out.length - 1]!;
    const b = stops[i]!;
    if (a.x === b.x || a.y === b.y) {
      out.push(b);
      continue;
    }
    // Only the first leg has a port to leave along; later legs follow the
    // one before them so the route does not alternate for no reason.
    const leaveHorizontal = i === 1
      ? isHorizontal(req.from.normal)
      : out.length > 1 && out[out.length - 2]!.y === a.y;
    // Likewise only the last leg has a port to arrive against. Without a
    // facing there is nothing to satisfy, so it keeps the single elbow.
    const arriving = i === stops.length - 1 ? req.to.normal : null;
    const arriveHorizontal = arriving == null ? !leaveHorizontal : isHorizontal(arriving);
    if (leaveHorizontal !== arriveHorizontal) {
      out.push(leaveHorizontal ? { x: b.x, y: a.y } : { x: a.x, y: b.y });
      out.push(b);
      continue;
    }
    // Splitting the leg at its midpoint starts back the way the route just
    // came when the last stop overshot this one; turning at once does not.
    const prev = out.length > 1 ? out[out.length - 2]! : null;
    if (leaveHorizontal) {
      const mid = (a.x + b.x) / 2;
      if (prev !== null && (mid - a.x) * (a.x - prev.x) < 0) out.push({ x: a.x, y: b.y }, b);
      else out.push({ x: mid, y: a.y }, { x: mid, y: b.y }, b);
    } else {
      const mid = (a.y + b.y) / 2;
      if (prev !== null && (mid - a.y) * (a.y - prev.y) < 0) out.push({ x: b.x, y: a.y }, b);
      else out.push({ x: a.x, y: mid }, { x: b.x, y: mid }, b);
    }
  }
  return out;
};

/** Which axis a port faces. A port with no facing counts as horizontal. */
function isHorizontal(normal: Vec2 | null | undefined): boolean {
  return Math.abs(normal?.x ?? 1) >= Math.abs(normal?.y ?? 0);
}

/**
 * A smooth route, sampled into points.
 *
 * Each leg is a cubic that leaves along the departing end's normal and arrives
 * against the receiving one's, and passes each waypoint without a corner.
 * Sampled rather than emitted as curve commands so every router returns the
 * same thing.
 */
export const bezier: Router = (req) => {
  const stops = [req.from.point, ...req.waypoints, req.to.point];
  const out: Vec2[] = [stops[0]!];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    const outN = i === 1 ? req.from.normal : through(stops, i - 1);
    const inN = i === stops.length - 1 ? req.to.normal : negated(through(stops, i));
    const leg = portCurvePoints(
      a.x, a.y, b.x, b.y,
      outN == null ? null : [outN.x, outN.y],
      inN == null ? null : [inN.x, inN.y],
      BEZIER_SAMPLES,
    );
    for (const [x, y] of leg) out.push({ x, y });
  }
  return out;
};

const BEZIER_SAMPLES = 16;

/**
 * The direction a smooth route passes an interior stop: along the straight run
 * it makes with a neighboring waypoint level with it on one axis, else from
 * the stop before it toward the one after. Two such waypoints are a run the
 * route was meant to hold, the way `layered` lays one through each rank.
 */
function through(stops: readonly Vec2[], i: number): Vec2 | null {
  const last = stops.length - 1;
  const run = (a: number, b: number) => a >= 1 && b <= last - 1 && (stops[a]!.x === stops[b]!.x || stops[a]!.y === stops[b]!.y);
  const [from, to] = run(i, i + 1) ? [i, i + 1] : run(i - 1, i) ? [i - 1, i] : [i - 1, i + 1];
  const dx = stops[to]!.x - stops[from]!.x;
  const dy = stops[to]!.y - stops[from]!.y;
  const len = Math.hypot(dx, dy);
  return len === 0 ? null : { x: dx / len, y: dy / len };
}

const negated = (v: Vec2 | null): Vec2 | null => (v === null ? null : { x: -v.x, y: -v.y });

/** The routers this package ships. A consumer's own go in the same shape. */
export const ROUTERS: Readonly<Record<string, Router>> = Object.freeze({
  straight,
  orthogonal,
  bezier,
});

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
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  const portOpts: PortsOptions<TPose> = { geometry, ...(opts.read ? { read: opts.read } : {}) };
  const allPorts = (d: DerivedDep<TPose>): Port[] =>
    portsOf(d.node as never, d.pose, portOpts);
  const centerOf = (d: DerivedDep<TPose>): Vec2 => {
    const b = geometry.getBounds(d.pose);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

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
    // Each end aims at its first waypoint, else at the other's center, which
    // is stable while both are being resolved — aiming at the other *port*
    // would be circular.
    const authored = edge.waypoints ?? [];
    const from = loop?.from ?? resolveEnd(edge.from, fromDep, authored[0] ?? centerOf(toDep), portOpts, allPorts);
    const to = loop?.to ?? resolveEnd(edge.to, toDep, authored[authored.length - 1] ?? centerOf(fromDep), portOpts, allPorts);
    if (from === undefined || to === undefined) return null;

    const waypoints = loop !== null && authored.length === 0 ? [loop.via] : authored;
    const routers = opts.routers ?? ROUTERS;
    const router = (edge.router !== undefined && routers[edge.router]) || straight;
    const points = router({ from, to, waypoints });
    return points.length < 2 ? null : polylineFromPoints(points as { x: number; y: number }[]);
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
  };
}
