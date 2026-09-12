/**
 * `DiagramEdge` — a connection between two participants.
 *
 * An edge is an ordinary leaf scene node with `dependsOn: [from, to]` and a
 * `derivePath` that runs a **router**. Making it a scene node rather than a
 * plugin-owned render layer is the load-bearing choice: it buys selection,
 * hit-testing, hover, styling, z-order, SVG export, undo and copy/paste
 * without implementing any of them. The cost is that an edge costs what a node
 * costs — right for diagrams of tens to hundreds of edges, wrong for a
 * 10k-edge force graph, which keeps its render layer.
 *
 * **Author-dragged waypoints are data on the edge and the router routes
 * through them.** Manual control never authors the path; it authors
 * constraints on the path. That is what keeps derived geometry and hand-tuning
 * compatible — a moved endpoint still re-routes, through the waypoints the
 * author put there.
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
import { DIAGRAM_LABEL, LABEL_DERIVE_POSE } from './label';
import { portOf, portsOf, type PortsOptions } from './ports';
import type { Port } from './types';

/** Where an edge attaches at one end. */
export interface EdgeEnd {
  /** The port to leave from, when the endpoint declares one. Falls back to
   *  the nearest port, so an edge drawn before ports were thought about still
   *  meets the shape. */
  port?: string;
}

/** The trait on an edge's `data`, under the same key participants use. */
export interface DiagramEdge {
  from: EdgeEnd;
  to: EdgeEnd;
  /** Registry key for the router. Resolved by whoever builds the edge's
   *  `derivePath`; unknown keys fall back to `straight`. */
  router?: string;
  /** Points in world coordinates the route must pass through, in order. The
   *  author owns these; the router owns everything between them. */
  waypoints?: readonly Vec2[];
}

/** What a router is given: the two resolved ends, and the author's waypoints
 *  between them. */
export interface RouteRequest {
  from: Port;
  to: Port;
  waypoints: readonly Vec2[];
}

/** A router returns the points the edge runs through, `from.point` first and
 *  `to.point` last. Turning those into a `Path` is `edgePath`'s job, so a
 *  router never has to know about path encodings. */
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
 * shape — a route that lands on a west-facing port from above puts its marker
 * across the corner, which reads as aimed at nothing.
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
    if (leaveHorizontal) {
      const mid = (a.x + b.x) / 2;
      out.push({ x: mid, y: a.y }, { x: mid, y: b.y }, b);
    } else {
      const mid = (a.y + b.y) / 2;
      out.push({ x: a.x, y: mid }, { x: b.x, y: mid }, b);
    }
  }
  return out;
};

/** Which axis a port faces. A port with no facing counts as horizontal, which
 *  is the leave-rightward default the router has always taken. */
function isHorizontal(normal: Vec2 | null | undefined): boolean {
  return Math.abs(normal?.x ?? 1) >= Math.abs(normal?.y ?? 0);
}

/** How far a bezier reaches along each end's normal, as a fraction of the
 *  straight-line distance between the two points it joins. */
const BEZIER_REACH = 0.4;

/**
 * A smooth route, sampled into points.
 *
 * Each leg is a cubic that leaves along the departing end's normal and arrives
 * against the receiving one's, which is what makes a bezier edge read as
 * plugged into its port rather than aimed at it. Sampled rather than emitted
 * as curve commands so every router returns the same thing; `edgePath` is free
 * to emit curves later without changing the contract.
 */
export const bezier: Router = (req) => {
  const stops = [req.from.point, ...req.waypoints, req.to.point];
  const out: Vec2[] = [stops[0]!];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    const reach = Math.hypot(b.x - a.x, b.y - a.y) * BEZIER_REACH;
    const outN = i === 1 ? req.from.normal : null;
    const inN = i === stops.length - 1 ? req.to.normal : null;
    const c1 = outN === null || outN === undefined
      ? { x: a.x + (b.x - a.x) * BEZIER_REACH, y: a.y + (b.y - a.y) * BEZIER_REACH }
      : { x: a.x + outN.x * reach, y: a.y + outN.y * reach };
    const c2 = inN === null || inN === undefined
      ? { x: b.x - (b.x - a.x) * BEZIER_REACH, y: b.y - (b.y - a.y) * BEZIER_REACH }
      : { x: b.x + inN.x * reach, y: b.y + inN.y * reach };
    for (let s = 1; s <= BEZIER_SAMPLES; s++) {
      out.push(cubicAt(a, c1, c2, b, s / BEZIER_SAMPLES));
    }
  }
  return out;
};

const BEZIER_SAMPLES = 16;

function cubicAt(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** The routers this package ships. A consumer's own go in the same shape. */
export const ROUTERS: Readonly<Record<string, Router>> = Object.freeze({
  straight,
  orthogonal,
  bezier,
});

/** The edge trait on a node's data, or `null`. */
export function diagramEdgeOf(node: { data: unknown }): DiagramEdge | null {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const edge = (data as { diagram?: unknown }).diagram;
  if (edge === null || typeof edge !== 'object') return null;
  return 'from' in edge && 'to' in edge ? (edge as DiagramEdge) : null;
}

/**
 * The port an end resolves to: the one it named, else the port facing the
 * other end most directly.
 *
 * "Facing" rather than "nearest": a port on the far side of a wide node can be
 * closer in a straight line than the one pointing at the target, and an edge
 * that leaves through its own node reads as a bug however short it is.
 */
export function resolveEnd<TPose>(
  end: EdgeEnd,
  dep: DerivedDep<TPose>,
  toward: Vec2,
  opts: PortsOptions<TPose>,
  allPorts: (d: DerivedDep<TPose>) => Port[],
): Port | undefined {
  if (end.port !== undefined) {
    const named = portOf(dep.node as never, dep.pose, end.port, opts);
    if (named !== undefined) return named;
  }
  let best: Port | undefined;
  let bestScore = -Infinity;
  for (const port of allPorts(dep)) {
    const dx = toward.x - port.point.x;
    const dy = toward.y - port.point.y;
    const len = Math.hypot(dx, dy) || 1;
    // Alignment with the port's own facing, tie-broken toward the closer port.
    const facing = port.normal === null
      ? 0
      : (port.normal.x * dx + port.normal.y * dy) / len;
    const score = facing - len / 1e6;
    if (score > bestScore) {
      bestScore = score;
      best = port;
    }
  }
  return best;
}

export interface EdgeRouteOptions<TPose> extends PortsOptions<TPose> {
  /** Routers by key. Defaults to {@link ROUTERS}. */
  routers?: Readonly<Record<string, Router>>;
}

/**
 * A `derivePath` that routes an edge between its two dependencies.
 *
 * Returns `null` — nothing to draw — when the node is not an edge, when either
 * dependency is gone, or when an endpoint offers no ports at all. A dangling
 * edge painting a line to the origin is worse than a dangling edge painting
 * nothing.
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

  return (node, deps) => {
    const edge = diagramEdgeOf(node);
    if (edge === null) return null;
    const [fromDep, toDep] = deps;
    if (fromDep === undefined || toDep === undefined) return null;

    // Each end aims at the other's center, which is stable while both are
    // being resolved — aiming at the other *port* would be circular.
    const from = resolveEnd(edge.from, fromDep, centerOf(toDep), portOpts, allPorts);
    const to = resolveEnd(edge.to, toDep, centerOf(fromDep), portOpts, allPorts);
    if (from === undefined || to === undefined) return null;

    const routers = opts.routers ?? ROUTERS;
    const router = (edge.router !== undefined && routers[edge.router]) || straight;
    const points = router({ from, to, waypoints: edge.waypoints ?? [] });
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
export function withDiagramRegistry<TPose>(
  registry: SceneRegistry<TPose> = {},
): SceneRegistry<TPose> {
  return {
    ...registry,
    derivePath: {
      [DIAGRAM_EDGE]: EDGE_DERIVE_PATH as NonNullable<SceneRegistry<TPose>['derivePath']>[string],
      ...registry.derivePath,
    },
    derivePose: {
      [DIAGRAM_LABEL]: LABEL_DERIVE_POSE as NonNullable<SceneRegistry<TPose>['derivePose']>[string],
      ...registry.derivePose,
    },
  };
}
