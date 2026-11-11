/**
 * What a 3D scene offers a snap: the ground grid's lines bracket a probe on the ground at any pitch and any distance
 * from the origin, finite and on the lattice, and a grid too fine to tell its lines apart that far out leaves a box
 * still to snap to; the plane source offers each plane a box has a side or center on once per probe, within reach.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { IDENTITY_POSE_COMPOSITION, createScene, type SnapCollect } from '@weasel-js/core';
import type { Vec3 } from '@weasel-js/geom/3d';
import { createCamera } from '../camera';
import { createSnap } from '../deps';
import { isFinite3, pose, runs, tally, timeoutFor, v3 } from '../pbt.fixture';
import { aabbOfPose, type Pose3 } from '../pose3';
import { projectPoint } from '../project';
import type { Scene3d, World3d } from '../world';
import { boxCorner } from './probes3d';
import { alignPlaneSource, boxSnapSource, groundGridSource } from './sources';

const RUNS = 300;
const T = timeoutFor(RUNS, 5);

type W = World3d<object, 'solids'>;

/** A magnitude anywhere in the double range. */
const magnitude = fc.oneof(
  fc.double({ min: 1e-3, max: 1e3, noNaN: true }),
  fc.integer({ min: -300, max: 300 }).map((e) => 10 ** e),
);
const signed = fc.tuple(magnitude, fc.boolean(), fc.double({ min: 0, max: 1, noNaN: true })).map(([m, neg, f]) => (neg ? -1 : 1) * m * f);

function collectOf(probes: { id: string; at: Vec3; role: 'pointer' }[], reach = Infinity): SnapCollect<Vec3> {
  return {
    gesture: 'point', probes, delta0: { x: 0, y: 0, z: 0 }, exclude: [],
    reachWorld: (px) => px * reach, reachPx: 1,
  } as unknown as SnapCollect<Vec3>;
}

describe('groundGridSource, property', () => {
  it('offers finite lines on the lattice bracketing a ground probe, at any pitch and any distance out', () => {
    const seen = tally();
    fc.assert(fc.property(magnitude, signed, signed, (step, a, b) => {
      const src = groundGridSource({ step });
      const out = [...src.collect(collectOf([{ id: 'p', at: { x: a, y: 0, z: b }, role: 'pointer' }]))];
      for (const c of out) expect(isFinite3(c.locus.at as Vec3)).toBe(true);
      for (const [axis, c, lines] of [
        ['x', a, out.filter((o) => o.locus.dirs[0]!.z !== 0).map((o) => (o.locus.at as Vec3).x)],
        ['z', b, out.filter((o) => o.locus.dirs[0]!.x !== 0).map((o) => (o.locus.at as Vec3).z)],
      ] as const) {
        expect(new Set(lines).size).toBe(lines.length);
        if (lines.length === 0) {
          seen.count('none');
          continue;
        }
        seen.count(`${axis}:${lines.length}`);
        const ulp = Math.max(Math.abs(c), step) * 4e-16;
        for (const l of lines) {
          expect(Math.abs(l - c)).toBeLessThanOrEqual(step + ulp);
          expect(Math.abs(l - Math.round(l / step) * step)).toBeLessThanOrEqual(ulp);
        }
        if (lines.length === 2) {
          expect(Math.min(...lines)).toBeLessThanOrEqual(c + ulp);
          expect(Math.max(...lines)).toBeGreaterThanOrEqual(c - ulp);
        }
      }
    }), runs(RUNS));
    seen.atLeast('x:2', 50);
    seen.atLeast('none', 5);
  }, T);

  it('leaves a box edge in reach to snap to, however fine the grid beside it', () => {
    const seen = tally();
    const fine = fc.constantFrom(1e-300, 1e-200, 5e-324, 1e-20);
    fc.assert(fc.property(fine, fc.double({ min: 1e6, max: 1e9, noNaN: true }), fc.integer({ min: 0, max: 7 }), (step, far, corner) => {
      // Where one of the box's upright edges crosses the ground, which a point gesture on the ground can reach.
      const at = { x: far, y: 0, z: 0 };
      const p: Pose3 = { position: at, rotation: [0, 0, 0, 1], scale: { x: 1, y: 1, z: 1 } };
      const scene: Scene3d<object, 'solids'> = createScene<object, 'solids', Pose3>({
        composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'solids' }],
        initial: [{ kind: 'mark', layer: 'solids', pose: p, data: {} }],
      });
      const vp = { camera: createCamera({ target: at, distance: 6, pitch: 0.6, yaw: 0.4 }), width: 800, height: 600 };
      const world: W = { scene, viewport: () => vp };
      const snap = createSnap(world, { sources: [boxSnapSource(world), groundGridSource({ step })], reachPx: 12 });
      const c = projectPoint({ ...boxCorner(aabbOfPose(p), corner), y: 0 }, vp);
      if (!c) return;
      const press = { x: c.x + 3, y: c.y - 2 };
      const out = snap.begin({ gesture: 'point', press }).at(press, { suspend: false, constrain: false });
      seen.count('asked');
      expect(out.held).toBe(true);
      expect(Math.hypot(out.point.x - press.x, out.point.y - press.y)).toBeLessThanOrEqual(12);
    }), runs(RUNS));
    seen.atLeast('asked', 100);
  }, T);
});

describe('alignPlaneSource, property', () => {
  it('offers each plane a box has a side or center on once per probe, and only those within reach', () => {
    const seen = tally();
    const grid = fc.integer({ min: -4, max: 4 }).map((k) => k / 2);
    const snapped = fc.record({ position: fc.tuple(grid, grid, grid).map(([x, y, z]) => ({ x, y, z })), rotation: fc.constant([0, 0, 0, 1] as const), scale: fc.constant({ x: 1, y: 1, z: 1 }) });
    fc.assert(fc.property(fc.array(fc.oneof(pose(undefined, 3), snapped), { maxLength: 6 }), fc.array(v3(3), { minLength: 1, maxLength: 3 }), fc.double({ min: 0, max: 2, noNaN: true }),
      (poses, ats, r) => {
        const scene: Scene3d<object, 'solids'> = createScene<object, 'solids', Pose3>({
          composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'solids' }],
          initial: poses.map((p) => ({ kind: 'mark' as const, layer: 'solids' as const, pose: p, data: {} })),
        });
        const world: W = { scene, viewport: () => ({ camera: createCamera({}), width: 100, height: 100 }) };
        const probes = ats.map((at, i) => ({ id: `p${i}`, at, role: 'pointer' as const }));
        const out = [...alignPlaneSource(world).collect(collectOf(probes, r))];
        const boxes = poses.map((p) => aabbOfPose(p));
        for (const [i, q] of probes.entries()) {
          for (const axis of ['x', 'y', 'z'] as const) {
            const want = new Set(boxes.flatMap((b) => [b.min[axis], (b.min[axis] + b.max[axis]) / 2, b.max[axis]]).filter((v) => Math.abs(q.at[axis] - v) <= r).map((v) => v + 0));
            const got = out.filter((c) => c.probe === `p${i}` && c.locus.dirs.every((d) => (d as Vec3)[axis] === 0)).map((c) => (c.locus.at as Vec3)[axis] + 0);
            expect(got.length).toBe(new Set(got).size);
            expect(new Set(got)).toEqual(want);
            if (want.size > 1) seen.count('several');
          }
        }
      }), runs(RUNS));
    seen.atLeast('several', 50);
  }, T);
});
