import {
  asNodeId, sceneSharedUnitScopes, sceneUnitScopes,
  type PerAxis, type PlaneMap, type PlaneUnits, type PlaneValue, type SnapCollect, type SnapSource,
} from '@weasel-js/core';
import { gridPitch, scopedGridPitch, type GridScopes } from '../grid/scopedPitch';
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
  /** Read the unit scope the subject sits in: a node inside a millimeter
   *  sub-assembly snaps on that scope's pitch. The subject's scope is the one
   *  all its nodes share; for a gesture with none, the scope of the
   *  container it draws into (`SnapCollect.parent`), else the root. */
  scopes?: GridScopes;
}

/**
 * A grid as snap targets: for each origin or pointer probe, the grid line on
 * either side of it on each axis. Its reach is unlimited and it is a
 * fallback, so it holds every axis no target claims and never displaces one.
 * Its lines are the camera's, carried into the plane a gesture runs in.
 */
export function gridSnapSource(opts: GridSnapSourceOptions): SnapSource {
  const { scopes } = opts;
  const rootPitch = gridPitch(opts.spacing, opts.unitSystem, scopes);
  const pitchFor = (q: SnapCollect): PerAxis<number> => {
    if (!scopes || !q.scene) return rootPitch;
    if (q.ids?.length) return scopedGridPitch(opts.spacing, scopes, sceneSharedUnitScopes(q.scene, q.ids.map(asNodeId), scopes.root));
    if (q.parent === undefined) return rootPitch;
    return scopedGridPitch(opts.spacing, scopes, sceneUnitScopes(q.scene, asNodeId(q.parent), scopes.root, { inclusive: true }));
  };
  const o = opts.origin ?? { x: 0, y: 0 };
  const lines = (v: number, axis: 'x' | 'y', pitch: PerAxis<number>, plane: PlaneMap | null): [number, number] => {
    const s = plane ? plane.scale[axis] : 1;
    const near = roundToGridOn(v - o[axis] * s, axis, pitch[axis], plane) + o[axis] * s;
    const step = pitch[axis] * s;
    return [near, near + (v >= near ? step : -step)];
  };
  return {
    id: 'grid',
    tier: 'fallback',
    reachPx: Infinity,
    roles: ['origin', 'pointer'],
    *collect(q) {
      const pitch = pitchFor(q);
      for (const p of q.probes) {
        for (const axis of ['x', 'y'] as const) {
          for (const at of lines(p.at[axis], axis, pitch, q.plane ?? null)) yield { probe: p.id, locus: axisLine(axis, at, p.at) };
        }
      }
    },
  };
}
