/**
 * One connector's whole route: a stub off each port, then a leg per pair of
 * stops, each searched in a window that doubles on failure.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { simplifyStops } from '../polyline';
import { searchWindow, within } from './grid';
import type { ObstacleIndex } from './obstacles';
import { ENCLOSED, searchLeg, type LegResult, type LegSource, type LegTarget } from './search';
import type { SegmentIndex } from './segments';
import { dirOf, type Dir } from './turns';
import type { AvoidEdge, AvoidPort, Box, ResolvedAvoidOptions } from './types';

/** What routing one connector reads besides the connector. */
export interface EdgeRouteContext {
  index: ObstacleIndex;
  options: ResolvedAvoidOptions;
  /** The most a search window grows to. */
  limit: Box;
  /** Other connectors' routes to count crossings against; absent, none count. */
  crossings?: SegmentIndex | undefined;
}

/** Where a port's stub ends: `clearance + 1` out along its normal. */
function exitOf(port: AvoidPort, clearance: number): Vec2 {
  const len = Math.hypot(port.normal.x, port.normal.y) || 1;
  const k = (clearance + 1) / len;
  return { x: port.point.x + port.normal.x * k, y: port.point.y + port.normal.y * k };
}

const reversed = (v: Vec2): Vec2 => ({ x: -v.x, y: -v.y });

/**
 * `edge`'s route from its `from` port to its `to` port, both included, or
 * null when some leg has no path within the largest window. The route passes
 * each waypoint as a vertex of its own.
 */
export function routeEdge(edge: AvoidEdge, ctx: EdgeRouteContext): Vec2[] | null {
  const { clearance, bendPenalty, crossPenalty, margin } = ctx.options;
  const fromPorts = edge.from.ports;
  const toPorts = edge.to.ports;
  if (fromPorts.length === 0 || toPorts.length === 0) return null;
  const obstacles = ctx.index.forEdge(edge.from.node, edge.to.node);
  const waypoints = edge.waypoints ?? [];
  const crossings = ctx.crossings === undefined ? undefined : { index: ctx.crossings, penalty: crossPenalty };

  const legs: Vec2[][] = [];
  let fromPort: AvoidPort | null = null;
  let toPort: AvoidPort | null = null;
  let heading: Dir = 0;
  for (let k = 0; k <= waypoints.length; k++) {
    const sources: LegSource[] = k === 0
      ? fromPorts.map((p) => ({ point: exitOf(p, clearance), heading: dirOf(p.normal) }))
      : [{ point: waypoints[k - 1]!, heading }];
    const targets: LegTarget[] = k === waypoints.length
      ? toPorts.map((p) => ({ point: exitOf(p, clearance), arrive: dirOf(reversed(p.normal)) }))
      : [{ point: waypoints[k]!, arrive: null }];
    const points = [...sources.map((s) => s.point), ...targets.map((t) => t.point)];
    let grow = margin;
    let found: LegResult | typeof ENCLOSED | null = null;
    for (;;) {
      const window = searchWindow(points, grow);
      found = searchLeg(sources, targets, { edge: edge.id, obstacles, window, bendPenalty, crossings });
      if (found !== null || within(ctx.limit, window)) break;
      grow *= 2;
    }
    if (found === null || found === ENCLOSED) return null;
    if (k === 0) fromPort = fromPorts[found.source]!;
    if (k === waypoints.length) toPort = toPorts[found.target]!;
    heading = found.arrive;
    legs.push(found.points);
  }
  legs[0] = [fromPort!.point, ...legs[0]!];
  legs[legs.length - 1] = [...legs[legs.length - 1]!, toPort!.point];
  const out: Vec2[] = [];
  for (const leg of legs) {
    const simple = simplifyStops(leg);
    out.push(...(out.length === 0 ? simple : simple.slice(1)));
  }
  return out;
}
