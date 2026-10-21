/**
 * Which connectors an update has to reroute: those attached to a changed
 * shape, those whose route meets a changed obstacle's old or new inflated
 * bounds, those whose stops changed, those it has never routed, and those
 * holding no route.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { SegmentIndex } from './segments';
import { inflate, type AvoidEdge, type AvoidObstacle, type AvoidPort, type Box } from './types';

const sameBox = (a: Box, b: Box) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

function sameObstacle(a: AvoidObstacle, b: AvoidObstacle): boolean {
  if (a.kind !== b.kind || !sameBox(a.box, b.box)) return false;
  const am = a.members;
  const bm = b.members;
  if (am === bm) return true;
  if (am === undefined || bm === undefined || am.size !== bm.size) return false;
  for (const id of am) if (!bm.has(id)) return false;
  return true;
}

/** The ids of obstacles that differ between `before` and `now`, and the old
 *  and new boxes of each. */
export function changedObstacles(
  before: ReadonlyMap<string, AvoidObstacle>,
  now: readonly AvoidObstacle[],
): { ids: Set<string>; boxes: Box[] } {
  const ids = new Set<string>();
  const boxes: Box[] = [];
  const seen = new Set<string>();
  for (const o of now) {
    seen.add(o.id);
    const was = before.get(o.id);
    if (was !== undefined && sameObstacle(was, o)) continue;
    ids.add(o.id);
    boxes.push(o.box);
    if (was !== undefined) boxes.push(was.box);
  }
  for (const [id, was] of before) {
    if (seen.has(id)) continue;
    ids.add(id);
    boxes.push(was.box);
  }
  return { ids, boxes };
}

const portKey = (p: AvoidPort) => `${p.point.x},${p.point.y},${p.normal.x},${p.normal.y}`;

/** What an edge's route depends on besides the obstacles: its ends and stops. */
export const stopsKey = (e: AvoidEdge): string =>
  `${e.from.node}:${e.from.ports.map(portKey).join(';')}|${e.to.node}:${e.to.ports.map(portKey).join(';')}|${(e.waypoints ?? []).map((w) => `${w.x},${w.y}`).join(';')}`;

/** The port of `ports` facing `toward` most directly. */
function facing(ports: readonly AvoidPort[], toward: Vec2): AvoidPort | undefined {
  let best: AvoidPort | undefined;
  let score = -Infinity;
  for (const p of ports) {
    const dx = toward.x - p.point.x;
    const dy = toward.y - p.point.y;
    const len = Math.hypot(dx, dy) || 1;
    const s = (p.normal.x * dx + p.normal.y * dy) / len - len / 1e6;
    if (s > score) {
      score = s;
      best = p;
    }
  }
  return best;
}

const centroid = (ports: readonly AvoidPort[]): Vec2 => ({
  x: ports.reduce((s, p) => s + p.point.x, 0) / Math.max(1, ports.length),
  y: ports.reduce((s, p) => s + p.point.y, 0) / Math.max(1, ports.length),
});

/** `edge`'s stored route with its ends, each end at the port facing the
 *  route's nearest bend, as the edge draws it. */
export function fullRoute(edge: AvoidEdge): Vec2[] {
  const route = edge.route ?? [];
  const from = facing(edge.from.ports, route[0] ?? centroid(edge.to.ports));
  const to = facing(edge.to.ports, route[route.length - 1] ?? centroid(edge.from.ports));
  return [...(from ? [from.point] : []), ...route, ...(to ? [to.point] : [])];
}

/** What an update reroutes, most urgent first: connectors attached to a
 *  changed shape or with changed stops, then the rest. */
export function dirtyEdges(
  edges: readonly AvoidEdge[],
  keys: ReadonlyMap<string, string>,
  changed: { ids: ReadonlySet<string>; boxes: readonly Box[] },
  clearance: number,
  routes: (edge: AvoidEdge) => readonly Vec2[],
): AvoidEdge[] {
  const first: AvoidEdge[] = [];
  const meeting = new Set<string>();
  if (changed.boxes.length > 0) {
    const index = new SegmentIndex();
    for (const e of edges) index.add(e.id, routes(e));
    for (const box of changed.boxes) index.edgesMeeting(inflate(box, clearance), meeting);
  }
  const rest: AvoidEdge[] = [];
  for (const e of edges) {
    const attached = changed.ids.has(e.from.node) || changed.ids.has(e.to.node);
    if (attached || keys.get(e.id) !== stopsKey(e) || e.route === undefined) first.push(e);
    else if (meeting.has(e.id)) rest.push(e);
  }
  return [...first, ...rest];
}
