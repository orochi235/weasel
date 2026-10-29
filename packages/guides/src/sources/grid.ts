import {
  asNodeId, sceneSharedUnitScopes, sceneUnitScopes,
  type NodeId, type PerAxis, type PlaneMap, type PlaneUnits, type PlaneValue, type SnapCollect, type SnapFrame,
  type SnapSource, type SourceCandidate,
} from '@weasel-js/core';
import { scopeOwner } from '../grid/regions';
import { gridPitch, scopedGridPitch, type GridScopes } from '../grid/scopedPitch';
import { roundToGridOn } from '../strategies/onPlane';
import { axisLine, frameLine } from './lines';

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
   *  container it draws into (`SnapCollect.parent`), else the root. When that
   *  scope is one container's, the lattice runs in its frame
   *  (`SnapCollect.frameOf`): from its corner, turned as it is. */
  scopes?: GridScopes;
}

/** The lattice a gesture snaps on: its pitch, and the frame of the container
 *  it runs in, or none for the root's. */
interface Lattice {
  pitch: PerAxis<number>;
  frame?: SnapFrame | undefined;
}

/**
 * A grid as snap targets: for each box or pointer probe, the grid line on
 * either side of it on each axis, so a move lands the drawn box, stroke
 * included, with an edge or its center on a line; on a turned container's
 * lattice, which no world-axis box lines up with, its pose origin. Its reach is unlimited and it is a
 * fallback, so it holds every axis no target claims and never displaces one.
 * Its lines are the camera's, carried into the plane a gesture runs in.
 */
export function gridSnapSource(opts: GridSnapSourceOptions): SnapSource {
  const { scopes } = opts;
  const rootPitch = gridPitch(opts.spacing, opts.unitSystem, scopes);
  const latticeFor = (q: SnapCollect): Lattice => {
    const scene = q.scene;
    if (!scopes || !scene) return { pitch: rootPitch };
    const within = (owner: NodeId | null) => (owner === null ? undefined : q.frameOf?.(owner));
    if (q.ids?.length) {
      const ids = q.ids.map(asNodeId);
      const owners = new Set(ids.map((id) => scopeOwner(scene, id)));
      return {
        pitch: scopedGridPitch(opts.spacing, scopes, sceneSharedUnitScopes(scene, ids, scopes.root)),
        // Nodes in two containers share no one lattice, whatever their scopes.
        frame: owners.size === 1 ? within([...owners][0]!) : undefined,
      };
    }
    if (q.parent === undefined) return { pitch: rootPitch };
    const parent = asNodeId(q.parent);
    return {
      pitch: scopedGridPitch(opts.spacing, scopes, sceneUnitScopes(scene, parent, scopes.root, { inclusive: true })),
      frame: within(scopeOwner(scene, parent, true)),
    };
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
    roles: ['box', 'origin', 'pointer'],
    *collect(q) {
      const { pitch, frame } = latticeFor(q);
      const plane = q.plane ?? null;
      const skip = frame && turns(frame) ? 'box' : 'origin';
      for (const p of q.probes) {
        if (p.role === skip) continue;
        if (frame) {
          yield* framedLines(p.id, p.at, pitch, frame, plane);
          continue;
        }
        for (const axis of ['x', 'y'] as const) {
          for (const at of lines(p.at[axis], axis, pitch, plane)) yield { probe: p.id, locus: axisLine(axis, at, p.at) };
        }
      }
    },
  };
}

/** Whether `frame`'s axes are turned or skewed off the world's, so that a
 *  world-axis box cannot line up with its lattice. */
function turns(frame: SnapFrame): boolean {
  const o = frame.toWorld({ x: 0, y: 0 });
  const ex = frame.toWorld({ x: 1, y: 0 });
  const ey = frame.toWorld({ x: 0, y: 1 });
  const along = (a: Point, axis: 'x' | 'y') => {
    const d = { x: a.x - o.x, y: a.y - o.y };
    return axis === 'x' ? Math.abs(d.y) <= 1e-9 * Math.abs(d.x) : Math.abs(d.x) <= 1e-9 * Math.abs(d.y);
  };
  return !((along(ex, 'x') && along(ey, 'y')) || (along(ex, 'y') && along(ey, 'x')));
}

/** The lines of `frame`'s lattice either side of `at` on each of its axes,
 *  running from the frame's origin. */
function* framedLines(
  probe: string, at: Point, pitch: PerAxis<number>, frame: SnapFrame, plane: PlaneMap | null,
): Generator<SourceCandidate> {
  const local = frame.toLocal(at);
  if (!local) return;
  for (const axis of ['x', 'y'] as const) {
    const step = pitch[axis] * (plane ? plane.scale[axis] : 1);
    const near = Math.round(local[axis] / step) * step;
    for (const offset of [near, near + (local[axis] >= near ? step : -step)]) {
      yield { probe, locus: frameLine(frame, axis, offset, local) };
    }
  }
}
