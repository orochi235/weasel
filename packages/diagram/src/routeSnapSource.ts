/**
 * The snap targets a route-handle drag brings: the stops beside the dragged
 * point and each end's port axis, which exist only for that drag.
 */
import type { SnapSource, SourceCandidate } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import type { Port } from './types';

/** Options for {@link routeSnapSource}. */
export interface RouteSnapSourceOptions {
  /** Must not collide with a source the canvas asks. */
  id: string;
  /** Points a dragged handle lines up with on either axis. */
  stops: readonly Vec2[];
  /** Ports a dragged handle lines up with along their axis. */
  ports: readonly Port[];
  /** Screen px. */
  reachPx: number;
}

type Axis = 'x' | 'y';

const BOTH: readonly Axis[] = ['x', 'y'];
/** The direction of the line holding coordinate `axis` fixed. */
const ALONG: Record<Axis, Vec2> = { x: { x: 0, y: 1 }, y: { x: 1, y: 0 } };

/** The coordinates a port lines up on: a port facing east or west on y, one
 *  facing north or south on x, and one facing nowhere on both. */
function portAxes(port: Port): readonly Axis[] {
  const n = port.normal;
  if (n === null) return BOTH;
  return Math.abs(n.x) >= Math.abs(n.y) ? ['y'] : ['x'];
}

/** A pointer source for a route drag: a line through each stop on each axis,
 *  and through each port along its axis, marked from the target to where the
 *  handle lands. */
export function routeSnapSource(opts: RouteSnapSourceOptions): SnapSource {
  const targets = [
    ...opts.stops.map((at) => ({ at, axes: BOTH })),
    ...opts.ports.map((p) => ({ at: p.point, axes: portAxes(p) })),
  ];
  return {
    id: opts.id,
    tier: 'target',
    reachPx: opts.reachPx,
    roles: ['pointer'],
    gestures: ['point'],
    *collect(q): Iterable<SourceCandidate> {
      const reach = q.reachWorld(q.reachPx);
      for (const p of q.probes) {
        for (const t of targets) {
          for (const axis of t.axes) {
            if (Math.abs(p.at[axis] - t.at[axis]) > reach) continue;
            yield {
              probe: p.id,
              locus: { at: { ...p.at, [axis]: t.at[axis] }, dirs: [ALONG[axis]] },
              mark: (delta) => ({
                kind: 'line',
                from: t.at,
                to: { x: p.at.x - q.delta0.x + delta.x, y: p.at.y - q.delta0.y + delta.y },
              }),
            };
          }
        }
      }
    },
  };
}
