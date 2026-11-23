/**
 * Connectors' labels as obstacles: each stationed on its own connector's
 * route, the way the label node derives its pose.
 */
import { polylineFromPoints, type Vec2 } from '@weasel-js/core/math';
import { labelCenter } from '../labels/station';
import type { AvoidEdge, AvoidLabel, AvoidObstacle } from './types';

/** `label`, of connector `edge`, standing on `route`, the route with its ends;
 *  null when it finds no place there. */
export function labelObstacle(edge: string, label: AvoidLabel, route: readonly Vec2[]): AvoidObstacle | null {
  if (route.length < 2) return null;
  const center = labelCenter(polylineFromPoints(route as Vec2[]), label.placement, label.size);
  if (center === null) return null;
  const { width, height } = label.size;
  return { id: label.id, kind: 'label', edge, box: { x: center.x - width / 2, y: center.y - height / 2, width, height } };
}

/** Every label of `edges`, each on the route `routeOf` gives its connector. */
export function labelObstacles(edges: readonly AvoidEdge[], routeOf: (edge: AvoidEdge) => readonly Vec2[]): AvoidObstacle[] {
  const out: AvoidObstacle[] = [];
  for (const edge of edges) {
    if (edge.labels === undefined || edge.labels.length === 0) continue;
    const route = routeOf(edge);
    for (const label of edge.labels) {
      const o = labelObstacle(edge.id, label, route);
      if (o !== null) out.push(o);
    }
  }
  return out;
}
