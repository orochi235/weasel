import type { Vec2 } from '@weasel-js/core';
import type { Port } from './types';

/** How a self-edge naming at most one port leaves its node and comes back. */
export interface SelfLoop {
  from: Port;
  to: Port;
  /** A point outside the node, off the corner between the two sides. */
  via: Vec2;
}

const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/**
 * The route a self-edge takes when no more than one end names a port: out by
 * one side and back by the next one round, past a point `standoff` clear of
 * both.
 *
 * An end that names no port aims at its own node's center, so every port
 * faces it equally, and left alone it would pick the same port as the other
 * end, or the one opposite with the edge drawn through the node. The sides
 * are taken by where they face on the page, east and then north, so the loop
 * sits at the same corner of every node however its ports are listed. Given
 * the port one end resolved to as `fixed`, the other end takes the side next
 * round from it, on the turn east makes to north. `null` where the node has
 * no two ports facing different ways.
 */
export function selfLoop(ports: readonly Port[], standoff: number, fixed: { from?: Port; to?: Port } = {}): SelfLoop | null {
  const facing = ports.filter((p): p is Port & { normal: Vec2 } => p.normal !== null);
  // Of two facing `dir` alike, the one facing a quarter turn on from it, as north is from east, so the list's order
  // never decides.
  const most = (dir: Vec2, among: typeof facing) => {
    const then = { x: dir.y, y: -dir.x };
    return among.reduce<(typeof facing)[number] | undefined>((best, p) => {
      if (best === undefined) return p;
      const [a, b] = [dot(p.normal, dir), dot(best.normal, dir)];
      return a > b || (a === b && dot(p.normal, then) > dot(best.normal, then)) ? p : best;
    }, undefined);
  };
  // Across, not along: a second port on the same side would fold the loop flat.
  const across = (side: Vec2) => facing.filter((p) => Math.abs(dot(p.normal, side)) < 0.5);
  let from: (typeof facing)[number] | undefined;
  let to: (typeof facing)[number] | undefined;
  if (fixed.to !== undefined) {
    if (fixed.to.normal === null) return null;
    to = fixed.to as (typeof facing)[number];
    from = most({ x: -to.normal.y, y: to.normal.x }, across(to.normal));
  } else {
    from = fixed.from === undefined
      ? most({ x: 1, y: 0 }, facing)
      : fixed.from.normal === null ? undefined : fixed.from as (typeof facing)[number];
    const next = fixed.from === undefined || from === undefined ? { x: 0, y: -1 } : { x: from.normal.y, y: -from.normal.x };
    if (from !== undefined) to = most(next, across(from.normal));
  }
  if (from === undefined || to === undefined) return null;
  // Out along the first side's facing, then along the second's until level with its own standoff.
  const out = { x: from.point.x + from.normal.x * standoff, y: from.point.y + from.normal.y * standoff };
  const reach = dot({ x: to.point.x - out.x, y: to.point.y - out.y }, to.normal) + standoff;
  return { from, to, via: { x: out.x + to.normal.x * reach, y: out.y + to.normal.y * reach } };
}
