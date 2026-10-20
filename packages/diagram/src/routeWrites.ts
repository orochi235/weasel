/**
 * The edge half of writing a layout to a scene: each edge's waypoints, and
 * where its label sits among them.
 *
 * Layout writes only what it owns. An edge's route is its own while the edge
 * has no waypoints or still has the ones layout last wrote (`laidOut`), and
 * is not an `avoid` connector, which only gets its ports named; a
 * label's place is its own while the label sits at the default middle or at a
 * `{ near }`, and its edge's route is layout's.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { diagramEdgeOf, layoutOwnsPort, layoutWritesRoute, type DiagramEdge, type EdgeEnd } from './edgeTrait';
import { labelFollowsLayout, type Graph } from './graph';
import { diagramLabelOf, type DiagramLabel } from './labelTrait';
import type { LayoutPlan, LayoutPorts } from './layout';

/** Edge routes for `applyLayout` to write alongside a layout's moves. */
export interface LayoutRoutes {
  /** Every edge the layout laid out. Each one layout owns gets its route
   *  from `waypoints`, or loses the one a layout gave it before. */
  edges: ReadonlySet<string>;
  waypoints: ReadonlyMap<string, readonly Vec2[]>;
  labels?: ReadonlyMap<string, Vec2>;
  /** The ports layout names. Each end layout owns gets its port from here,
   *  or loses the one a layout named before. */
  ports?: ReadonlyMap<string, LayoutPorts>;
}

/** How far a route may sit from the one already written and still count as
 *  it, in world units: a re-run's translation can land an ulp off. */
const ROUTE_TOLERANCE = 1e-3;

/** The routes `plan` laid out for `graph`'s edges. A layout that routes
 *  nothing routes every edge straight, taking back what `layered` wrote. */
export function routesOf(graph: Graph, plan: LayoutPlan): LayoutRoutes {
  return {
    edges: new Set(graph.edges.map((e) => e.origin?.id ?? e.id)),
    waypoints: plan.waypoints ?? new Map(),
    ...(plan.labels !== undefined ? { labels: plan.labels } : {}),
    ...(plan.ports !== undefined ? { ports: plan.ports } : {}),
  };
}

/** A scene as {@link routeWrites} reads it. */
export interface RoutedScene {
  get(id: never): { data: unknown } | undefined;
  isLocked(id: never): boolean;
  renderOrderNodes(): readonly { id: string; data: unknown; dependsOn?: readonly string[] | 'children' }[];
}

/** The new `data` for every edge and label whose route or place changes. A
 *  locked edge or label is left as it is. */
export function routeWrites(scene: RoutedScene, routes: LayoutRoutes): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const owned = new Set<string>();
  for (const id of routes.edges) {
    const node = scene.get(id as never);
    const edge = node === undefined ? null : diagramEdgeOf(node);
    if (node === undefined || edge === null || scene.isLocked(id as never)) {
      if (edge !== null && layoutWritesRoute(edge)) owned.add(id);
      continue;
    }
    let next = edge;
    if (layoutWritesRoute(edge)) {
      owned.add(id);
      next = rerouted(edge, routes.waypoints.get(id));
    }
    const ports = routes.ports?.get(id);
    const from = renamed(edge.from, ports?.from);
    const to = renamed(edge.to, ports?.to);
    if (from !== edge.from || to !== edge.to) next = { ...next, from, to };
    if (next !== edge) out.set(id, withTrait(node.data, next));
  }
  // The first label on an edge is the one `buildGraph` left room for.
  const stationed = new Set<string>();
  for (const node of scene.renderOrderNodes()) {
    const label = diagramLabelOf(node);
    const deps = node.dependsOn;
    if (label === null || !Array.isArray(deps) || deps.length !== 1 || !owned.has(deps[0]!)) continue;
    if (!labelFollowsLayout(label.at) || stationed.has(deps[0]!)) continue;
    stationed.add(deps[0]!);
    const near = routes.labels?.get(deps[0]!);
    const at: DiagramLabel['at'] = near === undefined ? 'mid' : { near };
    if (sameAt(label.at, at) || scene.isLocked(node.id as never)) continue;
    out.set(node.id, withTrait(node.data, { ...label, at }, 'label'));
  }
  return out;
}

/** `edge` on the route layout gave it, or `edge` itself when that changes
 *  nothing. No route clears the one layout wrote before. */
function rerouted(edge: DiagramEdge, route: readonly Vec2[] | undefined): DiagramEdge {
  if (route === undefined || route.length === 0) {
    if ((edge.waypoints ?? []).length === 0 && edge.laidOut === undefined) return edge;
    const { waypoints: _w, laidOut: _l, ...rest } = edge;
    return rest;
  }
  if (edge.waypoints !== undefined && near(edge.waypoints, route)) return edge;
  return { ...edge, waypoints: route, laidOut: route };
}

/** `end` with the port layout names for it, or `end` itself when layout does
 *  not own it or names what it already has. */
function renamed(end: EdgeEnd, port: string | undefined): EdgeEnd {
  if (!layoutOwnsPort(end) || (end.port === port && (port === undefined || end.laidOut === port))) return end;
  const { port: _p, laidOut: _l, ...rest } = end;
  return port === undefined ? rest : { ...rest, port, laidOut: port };
}

function near(a: readonly Vec2[], b: readonly Vec2[]): boolean {
  return a.length === b.length
    && a.every((p, i) => Math.abs(p.x - b[i]!.x) <= ROUTE_TOLERANCE && Math.abs(p.y - b[i]!.y) <= ROUTE_TOLERANCE);
}

function sameAt(a: DiagramLabel['at'], b: DiagramLabel['at']): boolean {
  if (typeof a === 'object' && typeof b === 'object') return near([a.near], [b.near]);
  return a === b;
}

/** `data` with its diagram trait, or one key of it, replaced. */
function withTrait(data: unknown, value: unknown, key?: string): unknown {
  const own = data as { diagram: Record<string, unknown> };
  const diagram = key === undefined ? value : { ...own.diagram, [key]: value };
  return { ...own, diagram };
}
