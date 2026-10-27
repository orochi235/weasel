/** What a 3D scene offers a snap session: its boxes' corners, edges, faces
 *  and centers, the planes through their sides and centers, and a grid on
 *  the ground. */

import type { SnapCollect, SnapMark, SnapSource, SourceCandidate } from '@weasel-js/core';
import { add, distance, dot, len, normalize, scale, sub, type Aabb, type Vec3 } from '@weasel-js/geom/3d';
import { DEFAULT_UP, type World3d } from '../world';
import { padQuery, snapBoxes } from './boxIndex';
import { planeBasis } from './plane';
import { boxCorner } from './probes3d';

type Axis = 'x' | 'y' | 'z';
type Candidate = SourceCandidate<Vec3>;

const AXES: readonly Axis[] = ['x', 'y', 'z'];
const BITS = [1, 2, 4] as const;
const UNIT: Record<Axis, Vec3> = { x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } };
const ACROSS: Record<Axis, readonly Vec3[]> = { x: [UNIT.y, UNIT.z], y: [UNIT.x, UNIT.z], z: [UNIT.x, UNIT.y] };

/** The boxes within `r` of a probe on every axis, a superset of those within `r` of it. */
function boxesNear<TData, TLayer extends string>(world: World3d<TData, TLayer>, q: SnapCollect<Vec3>, r: number): Aabb[] {
  return snapBoxes(world, q.exclude, q.probes.map(({ at: p }) => padQuery([p.x - r, p.y - r, p.z - r, p.x + r, p.y + r, p.z + r])));
}

/** The boxes reaching within `r` of a probe along some axis: every box with a side or center plane in reach. */
function boxesInSlabs<TData, TLayer extends string>(world: World3d<TData, TLayer>, q: SnapCollect<Vec3>, r: number): Aabb[] {
  const slabs = q.probes.flatMap(({ at: p }) => AXES.map((axis) => {
    const lo = [-Infinity, -Infinity, -Infinity];
    const hi = [Infinity, Infinity, Infinity];
    const k = AXES.indexOf(axis);
    lo[k] = p[axis] - r;
    hi[k] = p[axis] + r;
    return padQuery([...lo, ...hi]);
  }));
  return snapBoxes(world, q.exclude, slabs);
}

function distanceToBox(p: Vec3, box: Aabb): number {
  const d = (a: Axis) => Math.max(box.min[a] - p[a], 0, p[a] - box.max[a]);
  return Math.hypot(d('x'), d('y'), d('z'));
}

const centerOf = (box: Aabb): Vec3 => scale(add(box.min, box.max), 0.5);
const isZero = (v: Vec3) => v.x === 0 && v.y === 0 && v.z === 0;

/**
 * Each node's world box as targets for geometry and pointer probes: its 8
 * corners and its center as points, its 12 edges as segments, and its 6
 * faces as bounded planes. Targets past the reach are not offered.
 */
export function boxSnapSource<TData, TLayer extends string>(world: World3d<TData, TLayer>): SnapSource<Vec3> {
  return {
    id: 'box',
    roles: ['geometry', 'pointer'],
    *collect(q) {
      const r = q.reachWorld(q.reachPx);
      for (const box of boxesNear(world, q, r)) {
        for (const p of q.probes) {
          if (distanceToBox(p.at, box) <= r) yield* boxLoci(p.id, p.at, box, r);
        }
      }
    },
  };
}

function* boxLoci(probe: string, at: Vec3, box: Aabb, r: number): Generator<Candidate> {
  for (let i = 0; i < 8; i++) {
    const c = boxCorner(box, i);
    if (distance(at, c) <= r) yield { probe, locus: { at: c, dirs: [] }, mark: { kind: 'point', at: c, glyph: 'corner' } };
  }
  const center = centerOf(box);
  if (distance(at, center) <= r) {
    yield { probe, locus: { at: center, dirs: [] }, mark: { kind: 'point', at: center, glyph: 'center' } };
  }
  for (let i = 0; i < 8; i++) {
    for (const bit of BITS) {
      if (i & bit) continue;
      const a = boxCorner(box, i);
      const b = boxCorner(box, i | bit);
      const dir = sub(b, a);
      if (isZero(dir) || distanceToBox(at, { min: a, max: b }) > r) continue;
      yield { probe, locus: { at: a, dirs: [dir], span: [[0, 1]] }, mark: { kind: 'line', from: a, to: b } };
    }
  }
  for (const bit of BITS) {
    const [b1, b2] = BITS.filter((b) => b !== bit) as [number, number];
    for (const base of [0, bit]) {
      const o = boxCorner(box, base);
      const far = boxCorner(box, base | b1 | b2);
      const d1 = sub(boxCorner(box, base | b1), o);
      const d2 = sub(boxCorner(box, base | b2), o);
      if (isZero(d1) || isZero(d2) || distanceToBox(at, { min: o, max: far }) > r) continue;
      yield {
        probe,
        locus: { at: o, dirs: [d1, d2], span: [[0, 1], [0, 1]] },
        mark: () => outline([o, boxCorner(box, base | b1), far, boxCorner(box, base | b2)]),
      };
    }
  }
}

function outline(ring: readonly Vec3[]): SnapMark<Vec3>[] {
  return ring.map((from, i) => ({ kind: 'line', from, to: ring[(i + 1) % ring.length]! }));
}

/**
 * The planes through each node's world box at its min, center and max on
 * every axis, as targets for box and pointer probes: alignment in depth as
 * well as across. Boxes sharing a plane offer it once, and its mark reaches
 * each of them.
 */
export function alignPlaneSource<TData, TLayer extends string>(world: World3d<TData, TLayer>): SnapSource<Vec3> {
  return {
    id: 'align-plane',
    roles: ['box', 'pointer'],
    *collect(q) {
      const r = q.reachWorld(q.reachPx);
      for (const [axis, planes] of planesOf(boxesInSlabs(world, q, r))) {
        for (const [value, ends] of planes) {
          for (const p of q.probes) {
            if (Math.abs(p.at[axis] - value) > r) continue;
            yield {
              probe: p.id,
              locus: { at: ends[0]!, dirs: ACROSS[axis] },
              mark: (delta: Vec3): SnapMark<Vec3>[] => {
                const from = add(sub(p.at, q.delta0), delta);
                return ends.map((to) => ({ kind: 'line', from, to }));
              },
            };
          }
        }
      }
    },
  };
}

/** Per axis, each plane value the boxes have a side or center on, and the
 *  point on it at each such box's center. */
function planesOf(boxes: readonly Aabb[]): Map<Axis, Map<number, Vec3[]>> {
  const out = new Map<Axis, Map<number, Vec3[]>>(AXES.map((a) => [a, new Map()]));
  for (const box of boxes) {
    const center = centerOf(box);
    for (const axis of AXES) {
      const planes = out.get(axis)!;
      for (const value of new Set([box.min[axis], center[axis], box.max[axis]])) {
        const on = { ...center, [axis]: value };
        const ends = planes.get(value);
        if (ends) ends.push(on);
        else planes.set(value, [on]);
      }
    }
  }
  return out;
}

/** Options for `groundGridSource`. */
export interface GroundGridSourceOptions {
  /** The grid's pitch, in world units. */
  step: number;
  /** The ground's normal; the grid lies on `up · p = 0`. Default `+y`. */
  up?: Vec3;
}

/**
 * A grid on the ground plane as snap targets: for each pointer or geometry
 * probe on the ground, the grid line on either side of it along each of the
 * ground's two axes. Its reach is unlimited and it is a fallback, so it
 * holds every axis no target claims and never displaces one.
 */
export function groundGridSource(opts: GroundGridSourceOptions): SnapSource<Vec3> {
  const up = normalize(opts.up ?? DEFAULT_UP);
  const [u, v] = planeBasis(up);
  const lines = (c: number): [number, number] => {
    const near = Math.round(c / opts.step) * opts.step;
    return [near, near + (c >= near ? opts.step : -opts.step)];
  };
  return {
    id: 'ground-grid',
    tier: 'fallback',
    reachPx: Infinity,
    roles: ['pointer', 'geometry'],
    *collect(q) {
      for (const p of q.probes) {
        if (Math.abs(dot(p.at, up)) > 1e-6 * Math.max(1, len(p.at))) continue;
        const a = dot(p.at, u);
        const b = dot(p.at, v);
        for (const at of lines(a)) yield { probe: p.id, locus: { at: add(scale(u, at), scale(v, b)), dirs: [v] } };
        for (const at of lines(b)) yield { probe: p.id, locus: { at: add(scale(u, a), scale(v, at)), dirs: [u] } };
      }
    },
  };
}
