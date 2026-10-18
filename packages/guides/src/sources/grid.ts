import { resolveAxes, type PlaneUnits, type PlaneValue, type SnapSource } from '@weasel-js/core';
import { roundToGridOn } from '../strategies/onPlane';
import { axisLine } from './lines';

type Point = { x: number; y: number };

/** Options for `gridSnapSource`. */
export interface GridSnapSourceOptions {
  /** The grid's pitch, or one per axis, in `unitSystem`'s units. */
  spacing: PlaneValue;
  /** A point the lattice passes through. Default `(0, 0)`. */
  origin?: Point;
  unitSystem?: PlaneUnits;
}

/**
 * A grid as snap targets: for each origin or pointer probe, the grid line on
 * either side of it on each axis. Its reach is unlimited and it is a
 * fallback, so it holds every axis no target claims and never displaces one.
 * Its lines are in the camera's world, as every snap target is.
 */
export function gridSnapSource(opts: GridSnapSourceOptions): SnapSource {
  const pitch = resolveAxes(opts.spacing, opts.unitSystem);
  const o = opts.origin ?? { x: 0, y: 0 };
  const lines = (v: number, axis: 'x' | 'y'): [number, number] => {
    const near = roundToGridOn(v - o[axis], axis, pitch[axis], null) + o[axis];
    return [near, near + (v >= near ? pitch[axis] : -pitch[axis])];
  };
  return {
    id: 'grid',
    tier: 'fallback',
    reachPx: Infinity,
    roles: ['origin', 'pointer'],
    *collect(q) {
      for (const p of q.probes) {
        for (const axis of ['x', 'y'] as const) {
          for (const at of lines(p.at[axis], axis)) yield { probe: p.id, locus: axisLine(axis, at, p.at) };
        }
      }
    },
  };
}
