/**
 * `Pose3` composition read the other way: `decompose` inverts `compose` from either side under any frame, a frame
 * read in itself is the identity, frames peel off a chain one at a time, a frame scaled near the ends of the double
 * range still reads a world pose as a finite local one, and a scene of containers nested a dozen deep folds every
 * node to the world pose its chain of frames composes, with its rotation still unit length.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createScene, type NodeId } from '@weasel-js/core';
import { multiply, quatFromAxisAngle, quatRotate, type Mat4, type Quat, type Vec3 } from '@weasel-js/geom/3d';
import { POSE3_COMPOSITION } from './composePose3';
import { direction, isFinite3, maxDiff3, pose, quat, runs, scale3, tally, timeoutFor, uniformScale3, v3 } from './pbt.fixture';
import { poseMatrix, type Pose3 } from './pose3';
import { worldPoseOf } from './world';

const RUNS = 300;
const T = timeoutFor(RUNS, 3);
const { compose, decompose } = POSE3_COMPOSITION;

const size = (p: Pose3): number => Math.max(
  1, ...[p.position, p.scale].flatMap((v) => [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)]),
);
const shrink = (p: Pose3): number => Math.max(1, ...[p.scale.x, p.scale.y, p.scale.z].map((s) => 1 / Math.abs(s)));

function rotationGap(a: Quat, b: Quat): number {
  const axes: Vec3[] = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
  return Math.max(...axes.map((e) => maxDiff3(quatRotate(a, e), quatRotate(b, e))));
}
const poseGap = (a: Pose3, b: Pose3): number =>
  Math.max(maxDiff3(a.position, b.position), maxDiff3(a.scale, b.scale), rotationGap(a.rotation, b.rotation));
const quatLen = (q: Quat): number => Math.hypot(q[0], q[1], q[2], q[3]);
const finitePose = (p: Pose3): boolean => isFinite3(p.position) && isFinite3(p.scale) && p.rotation.every(Number.isFinite);

/** A scale factor anywhere in the double range, either sign, subnormal included. */
const extreme = fc.tuple(
  fc.oneof(fc.double({ min: 0.1, max: 10, noNaN: true }), fc.constantFrom(5e-324, 1e-310, 1e-300, 1e-150, 1e150, 1e300)),
  fc.boolean(),
).map(([s, neg]) => (neg ? -s : s));
const extremeScale = fc.tuple(extreme, extreme, extreme).map(([x, y, z]) => ({ x, y, z }));

describe('POSE3_COMPOSITION inverted, property', () => {
  it('composes a frame with the local pose it reads any world pose as, back to that world pose', () => {
    fc.assert(fc.property(pose(scale3), pose(), (p, w) => {
      const back = compose(p, decompose(p, w));
      expect(poseGap(back, w)).toBeLessThanOrEqual(1e-10 * size(p) * shrink(p) * size(w) * 10);
    }), runs(RUNS));
  }, T);

  it('reads a frame in itself as the identity', () => {
    fc.assert(fc.property(pose(scale3), (p) => {
      const self = decompose(p, p);
      expect(maxDiff3(self.position, { x: 0, y: 0, z: 0 })).toBeLessThanOrEqual(1e-12 * size(p) * shrink(p));
      expect(maxDiff3(self.scale, { x: 1, y: 1, z: 1 })).toBeLessThanOrEqual(1e-15);
      expect(rotationGap(self.rotation, [0, 0, 0, 1])).toBeLessThanOrEqual(1e-12);
    }), runs(RUNS));
  }, T);

  it('peels the frames of a chain off one at a time, under uniformly scaled frames', () => {
    fc.assert(fc.property(pose(uniformScale3), pose(uniformScale3), pose(), (a, b, c) => {
      const world = compose(a, compose(b, c));
      const tol = 1e-10 * size(a) * size(b) * size(c) * shrink(a) * shrink(b);
      expect(poseGap(decompose(compose(a, b), world), c)).toBeLessThanOrEqual(tol);
      expect(poseGap(decompose(b, decompose(a, world)), c)).toBeLessThanOrEqual(tol);
    }), runs(RUNS));
  }, T);

  it('reads any world pose as a finite local one in a frame scaled anywhere in the double range', () => {
    const seen = tally();
    fc.assert(fc.property(fc.record({ position: v3(50), rotation: quat, scale: extremeScale }), pose(), (p, w) => {
      const local = decompose(p, w);
      expect(finitePose(local)).toBe(true);
      expect(finitePose(compose(p, local))).toBe(true);
      const tiny = [p.scale.x, p.scale.y, p.scale.z].some((s) => Math.abs(s) < 1e-200);
      seen.count(tiny ? 'tiny' : 'other');
    }), runs(RUNS));
    seen.atLeast('tiny', 30);
  }, T);
});

type Data = Record<string, never>;

describe('nested containers, property', () => {
  it('fold each node to the world pose its chain composes, its rotation unit length, its matrix the product', () => {
    const chain = fc.array(fc.record({ position: v3(5), rotation: quat, scale: uniformScale3 }), { minLength: 1, maxLength: 12 });
    fc.assert(fc.property(chain, pose(), (frames, leaf) => {
      const scene = createScene<Data, 'solids', Pose3>({ composition: POSE3_COMPOSITION, systemLayers: [{ id: 'solids' }] });
      let parent: NodeId | undefined;
      let folded: Pose3 | null = null;
      let matrix: Mat4 | null = null;
      for (const f of [...frames, leaf]) {
        parent = scene.add({ kind: 'group', layer: 'solids', data: {}, pose: f, ...(parent ? { parent } : {}) });
        folded = folded ? compose(folded, f) : f;
        matrix = matrix ? multiply(matrix, poseMatrix(f)) : poseMatrix(f);
      }
      const shown = worldPoseOf(scene, parent!)!;
      const reach = frames.reduce((k, f) => k * size(f), size(leaf));
      expect(poseGap(shown, folded!)).toBeLessThanOrEqual(1e-12 * reach);
      expect(Math.abs(quatLen(shown.rotation) - 1)).toBeLessThanOrEqual(1e-13 * (frames.length + 1));
      const got = poseMatrix(shown);
      for (let i = 0; i < 16; i++) expect(Math.abs(got[i]! - matrix![i]!)).toBeLessThanOrEqual(1e-10 * reach);
    }), runs(RUNS));
  }, T);
});

describe('quatFromAxisAngle, property', () => {
  it('is unit length for an axis of any length, subnormal and near the double range included', () => {
    const k = fc.constantFrom(1, 1e-321, 1e-310, 1e-160, 1e160, 1e306);
    fc.assert(fc.property(direction, k, fc.double({ min: -1e6, max: 1e6, noNaN: true }), (axis, s, angle) => {
      const q = quatFromAxisAngle({ x: axis.x * s, y: axis.y * s, z: axis.z * s }, angle);
      expect(Math.abs(quatLen(q) - 1)).toBeLessThanOrEqual(4e-16);
      // A subnormal axis keeps only a few bits of its direction, so only a normal one is held to it.
      if (s < 1e-300) return;
      const unit = quatFromAxisAngle(axis, angle);
      expect(rotationGap(q, unit)).toBeLessThanOrEqual(1e-15 * (1 + Math.abs(angle)) + 1e-12);
    }), runs(RUNS));
  }, T);
});
