import {
  asNodeId, sceneUnitScopes,
  type NodeId, type PlaneUnits, type SnapCollect, type SnapFrame, type SnapSource, type SourceCandidate,
} from '@weasel-js/core';
import { linesNear, mapLines, type GridLines, type GridSpacing } from '../grid/axes';
import { containerLines, gridLines, type GridScopes } from '../grid/reading';
import { gridOwner, type GridOwners } from '../grid/regions';
import { axisLine, frameLine } from './lines';

type Point = { x: number; y: number };
const AXES = ['x', 'y'] as const;

/** Options for `gridSnapSource`. */
export interface GridSnapSourceOptions {
  /** The grid's lines, one rule for both axes or one per axis, in
   *  `unitSystem`'s units. */
  spacing: GridSpacing;
  /** A point the root's lattice passes through. Default `(0, 0)`. */
  origin?: Point;
  unitSystem?: PlaneUnits;
  /** Read the unit scope the subject sits in: a node inside a millimeter
   *  sub-assembly snaps on that scope's lattice, in that container's frame. */
  scopes?: GridScopes;
  /** A container's own grid, which its children snap on in its frame (from
   *  its corner, turned and scaled as it is): the nearest container above
   *  the subject with one, or with a unit scope under `scopes`. `null` for a
   *  container with no grid inside it. */
  gridOf?: GridOwners['gridOf'];
  /** The source's id, so two grids can snap on one canvas. Default `'grid'`. */
  id?: string;
}

/** The lattice a gesture snaps on, and the frame of the container it runs
 *  in, or none for the root's. */
interface Lattice {
  lines: GridLines | null;
  frame?: SnapFrame | undefined;
}

/**
 * A grid as snap targets: for each probe, the grid line on either side of it
 * on each axis the grid has lines on, so a move lands the drawn box, stroke
 * included, with an edge or its center on a line; on a turned container's
 * lattice, which no world-axis box lines up with, its pose origin. A subject
 * declaring snap anchors (`SceneCanvasSnap.anchors`) lands those instead of
 * its box. Nodes spread over containers snap on the lattice they all run,
 * along the world's axes, and on none where those differ. Its reach is unlimited and it is a fallback,
 * so it holds every axis no target claims and never displaces one. Its lines
 * are the camera's, carried into the plane a gesture runs in.
 */
export function gridSnapSource(opts: GridSnapSourceOptions): SnapSource {
  const { scopes, gridOf } = opts;
  const owners: GridOwners = { ...(scopes ? { root: scopes.root } : {}), ...(gridOf ? { gridOf } : {}) };
  const rootLines = gridLines(opts.spacing, opts.unitSystem, scopes);
  const latticeOf = (q: SnapCollect, owner: NodeId | null): Lattice => {
    if (owner === null) return { lines: rootLines };
    const chain = scopes && q.scene ? sceneUnitScopes(q.scene, owner, scopes.root, { inclusive: true }) : undefined;
    return {
      lines: containerLines(gridOf?.(owner), opts.spacing, opts.unitSystem, scopes, chain),
      frame: q.frameOf?.(owner),
    };
  };
  const latticeFor = (q: SnapCollect): Lattice => {
    const scene = q.scene;
    if ((!scopes && !gridOf) || !scene) return { lines: rootLines };
    if (q.ids?.length) {
      const held = [...new Set(q.ids.map((id) => gridOwner(scene, asNodeId(id), owners)))];
      if (held.length === 1) return latticeOf(q, held[0]!);
      // Spread over containers, it snaps on the lattice they all run, along the world's axes.
      const each = held.map((owner) => JSON.stringify(latticeOf(q, owner).lines));
      return { lines: each.every((l) => l === each[0]) ? latticeOf(q, held[0]!).lines : null };
    }
    if (q.parent === undefined) return { lines: rootLines };
    return latticeOf(q, gridOwner(scene, asNodeId(q.parent), owners, true));
  };
  const o = opts.origin ?? { x: 0, y: 0 };
  return {
    id: opts.id ?? 'grid',
    tier: 'fallback',
    reachPx: Infinity,
    roles: ['box', 'origin', 'pointer', 'anchor'],
    *collect(q) {
      const { lines, frame } = latticeFor(q);
      if (!lines) return;
      const plane = q.plane ?? null;
      const scale = (axis: 'x' | 'y') => (plane ? plane.scale[axis] : 1);
      const anchored = q.probes.some((p) => p.role === 'anchor');
      const skip = frame && turns(frame) ? 'box' : 'origin';
      const probes = q.probes.filter((p) => (anchored ? p.role === 'anchor' || p.role === 'pointer' : p.role !== skip));
      if (frame) {
        const local = { x: lines.x && mapLines(lines.x, scale('x'), 0), y: lines.y && mapLines(lines.y, scale('y'), 0) };
        for (const p of probes) yield* framedLines(p.id, p.at, local, frame);
        return;
      }
      // Root lines run through `origin`, in the camera's world, carried into the plane.
      const shift = (axis: 'x' | 'y') => o[axis] * scale(axis) + (plane ? plane.offset[axis] : 0);
      const world = { x: lines.x && mapLines(lines.x, scale('x'), shift('x')), y: lines.y && mapLines(lines.y, scale('y'), shift('y')) };
      for (const p of probes) {
        for (const axis of AXES) {
          const a = world[axis];
          if (a) for (const at of linesNear(a, p.at[axis])) yield { probe: p.id, locus: axisLine(axis, at, p.at) };
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

/** The lines of `frame`'s lattice either side of `at` on each of its axes. */
function* framedLines(probe: string, at: Point, lines: GridLines, frame: SnapFrame): Generator<SourceCandidate> {
  const local = frame.toLocal(at);
  if (!local) return;
  for (const axis of AXES) {
    const a = lines[axis];
    if (a) for (const offset of linesNear(a, local[axis])) yield { probe, locus: frameLine(frame, axis, offset, local) };
  }
}
