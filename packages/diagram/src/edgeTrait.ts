/**
 * The edge trait: what an edge's `data` says about its ends and its route, and
 * who owns each. Data only — the routers and the scene wiring are in `edge`,
 * so layout can read an edge without reaching the scene.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { StyleField } from './theme/styleField';

/** Where an edge attaches at one end. */
export interface EdgeEnd {
  /** The port to leave from, when the endpoint declares one. Falls back to
   *  the nearest port, so an edge drawn before ports were thought about still
   *  meets the shape. */
  port?: string;
  /** The port layout last named here. While `port` still equals it, or names
   *  none, layout owns the end and names it again on its next run. */
  laidOut?: string;
}

/** Whether layout may name this end's port: it names none, or only the one
 *  layout last named. */
export function layoutOwnsPort(end: EdgeEnd): boolean {
  return end.port === undefined || end.port === end.laidOut;
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
  /** The waypoints layout last wrote here. While `waypoints` still equals
   *  them, layout owns the route and rewrites it on its next run; once anyone
   *  edits them, they are the author's and layout leaves them alone. */
  laidOut?: readonly Vec2[];
  /** The theme role it is drawn in. Unset, the theme's own connector style. */
  style?: string;
  /** The colors the author set by hand, which a theme leaves as they are. */
  ownStyle?: readonly StyleField[];
}

/** Whether layout may rewrite this edge's route: it has no waypoints, or only
 *  the ones layout last wrote. */
export function layoutOwnsRoute(edge: DiagramEdge): boolean {
  const points = edge.waypoints ?? [];
  if (points.length === 0) return true;
  return edge.laidOut !== undefined && samePoints(points, edge.laidOut);
}

/** Two point lists the same, point for point. */
export function samePoints(a: readonly Vec2[], b: readonly Vec2[]): boolean {
  return a.length === b.length && a.every((p, i) => p.x === b[i]!.x && p.y === b[i]!.y);
}

/** The edge trait on a node's data, or `null`. */
export function diagramEdgeOf(node: { data: unknown }): DiagramEdge | null {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const edge = (data as { diagram?: unknown }).diagram;
  if (edge === null || typeof edge !== 'object') return null;
  return 'from' in edge && 'to' in edge ? (edge as DiagramEdge) : null;
}
