/**
 * Connectors' labels as obstacles: each stationed on its own connector's
 * route, the way the label node derives its pose.
 */
import { polylineFromPoints, type Vec2 } from '@weasel-js/core/math';
import { labelCenter } from '../labels/station';
import type { AvoidEdge, AvoidObstacle } from './types';

/** `edge`'s label standing on `route`, the route with its ends, or null when
 *  it has none. */
export function labelObstacle(edge: AvoidEdge, route: readonly Vec2[]): AvoidObstacle | null {
  const label = edge.label;
  if (label === undefined || route.length < 2) return null;
  const center = labelCenter(polylineFromPoints(route as Vec2[]), label.placement, label.size);
  if (center === null) return null;
  const { width, height } = label.size;
  return { id: label.id, kind: 'label', edge: edge.id, box: { x: center.x - width / 2, y: center.y - height / 2, width, height } };
}

/** Every label of `edges`, each on the route `routeOf` gives its connector. */
export function labelObstacles(edges: readonly AvoidEdge[], routeOf: (edge: AvoidEdge) => readonly Vec2[]): AvoidObstacle[] {
  const out: AvoidObstacle[] = [];
  for (const edge of edges) {
    if (edge.label === undefined) continue;
    const o = labelObstacle(edge, routeOf(edge));
    if (o !== null) out.push(o);
  }
  return out;
}
