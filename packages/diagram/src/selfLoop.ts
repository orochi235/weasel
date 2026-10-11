import type { Vec2 } from '@weasel-js/core';
import type { Port } from './types';

/** How a self-edge with no ports named leaves its node and comes back. */
export interface SelfLoop {
  from: Port;
  to: Port;
  /** A point outside the node, off the corner between the two sides. */
  via: Vec2;
}

const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/**
 * The route a self-edge takes when neither end names a port: out by one side
 * and back by the next one round, past a point `standoff` clear of both.
 *
 * Both ends of such an edge aim at their own node's center, so every port
 * faces it equally, both pick the same one, and the edge has no length. The
 * sides are taken by where they face on the page, east and then north, so the
 * loop sits at the same corner of every node however its ports are listed.
 * `null` where the node has no two ports facing different ways.
 */
export function selfLoop(ports: readonly Port[], standoff: number): SelfLoop | null {
  const facing = ports.filter((p): p is Port & { normal: Vec2 } => p.normal !== null);
  const most = (dir: Vec2, among: typeof facing) =>
    among.reduce<(typeof facing)[number] | undefined>(
      (best, p) => (best === undefined || dot(p.normal, dir) > dot(best.normal, dir) ? p : best),
      undefined,
    );
  const from = most({ x: 1, y: 0 }, facing);
  if (from === undefined) return null;
  // Across, not along: a second port on the same side would fold the loop flat.
  const to = most({ x: 0, y: -1 }, facing.filter((p) => Math.abs(dot(p.normal, from.normal)) < 0.5));
  if (to === undefined) return null;
  // Out along the first side's facing, then along the second's until level with its own standoff.
  const out = { x: from.point.x + from.normal.x * standoff, y: from.point.y + from.normal.y * standoff };
  const reach = dot({ x: to.point.x - out.x, y: to.point.y - out.y }, to.normal) + standoff;
  return { from, to, via: { x: out.x + to.normal.x * reach, y: out.y + to.normal.y * reach } };
}
