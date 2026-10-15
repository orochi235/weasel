/**
 * The edge half of writing a layout to a scene: each edge's waypoints, and
 * where its label sits among them.
 *
 * Layout writes only what it owns. An edge's route is its own while the edge
 * has no waypoints or still has the ones layout last wrote (`laidOut`); a
 * label's place is its own while the label sits at the default middle or at a
 * `{ waypoint }`, and its edge's route is layout's.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { diagramEdgeOf, layoutOwnsRoute, samePoints, type DiagramEdge } from './edge';
import { labelFollowsLayout, type Graph } from './graph';
import { diagramLabelOf, type DiagramLabel } from './label';
import type { LayoutPlan } from './layout';

/** Edge routes for `applyLayout` to write alongside a layout's moves. */
export interface LayoutRoutes {
  /** Every edge the layout laid out. Each one layout owns gets its route
   *  from `waypoints`, or loses the one layout gave it last time. */
  edges: ReadonlySet<string>;
  waypoints: ReadonlyMap<string, readonly Vec2[]>;
  labels?: ReadonlyMap<string, number>;
}

/** The routes `plan` laid out for `graph`'s edges; `undefined` for a layout
 *  that routes nothing, which leaves every edge as it is. */
export function routesOf(graph: Graph, plan: LayoutPlan): LayoutRoutes | undefined {
  if (plan.waypoints === undefined) return undefined;
  return {
    edges: new Set(graph.edges.map((e) => e.origin?.id ?? e.id)),
    waypoints: plan.waypoints,
    ...(plan.labels !== undefined ? { labels: plan.labels } : {}),
  };
}

/** A scene as {@link routeWrites} reads it. */
export interface RoutedScene {
  get(id: never): { data: unknown } | undefined;
  renderOrderNodes(): readonly { id: string; data: unknown; dependsOn?: readonly string[] | 'children' }[];
}

/** The new `data` for every edge and label whose route or place changes. */
export function routeWrites(scene: RoutedScene, routes: LayoutRoutes): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const owned = new Set<string>();
  for (const id of routes.edges) {
    const node = scene.get(id as never);
    const edge = node === undefined ? null : diagramEdgeOf(node);
    if (node === undefined || edge === null || !layoutOwnsRoute(edge)) continue;
    owned.add(id);
    const next = rerouted(edge, routes.waypoints.get(id));
    if (next !== edge) out.set(id, withTrait(node.data, next));
  }
  for (const node of scene.renderOrderNodes()) {
    const label = diagramLabelOf(node);
    const deps = node.dependsOn;
    if (label === null || !Array.isArray(deps) || deps.length !== 1 || !owned.has(deps[0]!)) continue;
    if (!labelFollowsLayout(label.at)) continue;
    const k = routes.labels?.get(deps[0]!);
    const at: DiagramLabel['at'] = k === undefined ? 'mid' : { waypoint: k };
    if (sameAt(label.at, at)) continue;
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
  if (edge.waypoints !== undefined && samePoints(edge.waypoints, route)) return edge;
  return { ...edge, waypoints: route, laidOut: route };
}

function sameAt(a: DiagramLabel['at'], b: DiagramLabel['at']): boolean {
  if (typeof a === 'object' && typeof b === 'object') return a.waypoint === b.waypoint;
  return a === b;
}

/** `data` with its diagram trait, or one key of it, replaced. */
function withTrait(data: unknown, value: unknown, key?: string): unknown {
  const own = data as { diagram: Record<string, unknown> };
  const diagram = key === undefined ? value : { ...own.diagram, [key]: value };
  return { ...own, diagram };
}
