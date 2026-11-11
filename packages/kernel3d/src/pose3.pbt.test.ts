/**
 * `Pose3` and its container composition: identities, associativity and the matrix product under a uniform frame,
 * `decompose` undoing `compose` under any frame, a collapsed axis included, and the world box a pose occupies.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { multiply, quatRotate, transformPoint, type Aabb, type Mat4, type Quat, type Vec3 } from '@weasel-js/geom/3d';
import { POSE3_COMPOSITION } from './composePose3';
import { aabbOfPose, poseMatrix, UNIT_CUBE, type Pose3 } from './pose3';
import { factor, isFinite3, maxDiff3, pose, runs, scale3, tally, timeoutFor, uniformScale3, v3 } from './pbt.fixture';

const RUNS = 300;
const T = timeoutFor(RUNS, 2);
const { compose, decompose } = POSE3_COMPOSITION;
const IDENTITY: Pose3 = { position: { x: 0, y: 0, z: 0 }, rotation: [0, 0, 0, 1], scale: { x: 1, y: 1, z: 1 } };

const size = (p: Pose3): number => Math.max(
  1, ...[p.position, p.scale].flatMap((v) => [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)]),
);

/** Rotations compared as what they do, so `q` and `-q` agree. */
function rotationGap(a: Quat, b: Quat): number {
  const axes: Vec3[] = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
  return Math.max(...axes.map((e) => maxDiff3(quatRotate(a, e), quatRotate(b, e))));
}

function poseGap(a: Pose3, b: Pose3): number {
  return Math.max(maxDiff3(a.position, b.position), maxDiff3(a.scale, b.scale), rotationGap(a.rotation, b.rotation));
}

function matGap(a: Mat4, b: Mat4): number {
  let most = 0;
  for (let i = 0; i < 16; i++) most = Math.max(most, Math.abs(a[i]! - b[i]!));
  return most;
}

describe('POSE3_COMPOSITION, property', () => {
  it('has the identity pose on both sides', () => {
    fc.assert(fc.property(pose(), (p) => {
      expect(poseGap(compose(IDENTITY, p), p)).toBeLessThanOrEqual(1e-12 * size(p));
      expect(poseGap(compose(p, IDENTITY), p)).toBeLessThanOrEqual(1e-12 * size(p));
    }), runs(RUNS));
  }, T);

  it('associates when the outer frames are uniformly scaled', () => {
    fc.assert(fc.property(pose(uniformScale3), pose(uniformScale3), pose(), (a, b, c) => {
      const left = compose(compose(a, b), c);
      const right = compose(a, compose(b, c));
      expect(poseGap(left, right)).toBeLessThanOrEqual(1e-11 * size(a) * size(b) * size(c));
    }), runs(RUNS));
  }, T);

  it('is the matrix product under a uniformly scaled frame', () => {
    fc.assert(fc.property(pose(uniformScale3), pose(), (p, c) => {
      const want = multiply(poseMatrix(p), poseMatrix(c));
      expect(matGap(poseMatrix(compose(p, c)), want)).toBeLessThanOrEqual(1e-11 * size(p) * size(c));
    }), runs(RUNS));
  }, T);

  it('places a child where the frame matrix carries it, under any frame, when the child is unrotated', () => {
    fc.assert(fc.property(pose(), v3(50), (p, at) => {
      const child: Pose3 = { position: at, rotation: [0, 0, 0, 1], scale: { x: 1, y: 1, z: 1 } };
      const want = transformPoint(poseMatrix(p), at);
      expect(maxDiff3(compose(p, child).position, want)).toBeLessThanOrEqual(1e-11 * size(p) * Math.max(1, size(child)));
    }), runs(RUNS));
  }, T);

  it('undoes compose with decompose, and compose with decompose, under any frame', () => {
    fc.assert(fc.property(pose(scale3), pose(), (p, c) => {
      const world = compose(p, c);
      const back = decompose(p, world);
      expect(poseGap(back, c)).toBeLessThanOrEqual(1e-10 * size(p) ** 2 * size(c));
      expect(poseGap(compose(p, back), world)).toBeLessThanOrEqual(1e-10 * size(p) ** 2 * size(c));
    }), runs(RUNS));
  }, T);

  it('reads a world pose into a frame with a collapsed axis as one that composes back to it', () => {
    const seen = tally();
    const collapsed = fc.tuple(factor, factor, factor, fc.integer({ min: 1, max: 7 }))
      .map(([x, y, z, zeros]) => ({ x: zeros & 1 ? 0 : x, y: zeros & 2 ? 0 : y, z: zeros & 4 ? 0 : z }));
    fc.assert(fc.property(pose(collapsed), pose(), pose(), (p, c, w) => {
      const back = decompose(p, compose(p, c));
      expect(isFinite3(back.position) && isFinite3(back.scale)).toBe(true);
      expect(poseGap(compose(p, back), compose(p, c))).toBeLessThanOrEqual(1e-10 * size(p) ** 2 * size(c));
      const any = decompose(p, w);
      expect(isFinite3(any.position) && isFinite3(any.scale) && any.rotation.every(Number.isFinite)).toBe(true);
      seen.count(`zeros:${[p.scale.x, p.scale.y, p.scale.z].filter((s) => s === 0).length}`);
    }), runs(RUNS));
    for (const k of [1, 2, 3]) seen.atLeast(`zeros:${k}`, 10);
  }, T);
});

function cornersOf(box: Aabb): Vec3[] {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
    x: i & 1 ? box.max.x : box.min.x, y: i & 2 ? box.max.y : box.min.y, z: i & 4 ? box.max.z : box.min.z,
  }));
}

const localBox: fc.Arbitrary<Aabb> = fc.tuple(v3(5), v3(5)).map(([a, b]) => ({
  min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) },
  max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) },
}));

describe('aabbOfPose, property', () => {
  it('is the tightest box holding every corner of the posed local box', () => {
    fc.assert(fc.property(pose(), fc.oneof(fc.constant(UNIT_CUBE), localBox), (p, local) => {
      const box = aabbOfPose(p, local);
      const corners = cornersOf(local).map((c) => transformPoint(poseMatrix(p), c));
      const tol = 1e-11 * size(p) * 10;
      for (const axis of ['x', 'y', 'z'] as const) {
        const lo = Math.min(...corners.map((c) => c[axis]));
        const hi = Math.max(...corners.map((c) => c[axis]));
        expect(Math.abs(box.min[axis] - lo)).toBeLessThanOrEqual(tol);
        expect(Math.abs(box.max[axis] - hi)).toBeLessThanOrEqual(tol);
      }
    }), runs(RUNS));
  }, T);

  it('moves with the pose: translating the pose translates the box', () => {
    fc.assert(fc.property(pose(), v3(50), (p, by) => {
      const a = aabbOfPose(p);
      const b = aabbOfPose({ ...p, position: { x: p.position.x + by.x, y: p.position.y + by.y, z: p.position.z + by.z } });
      const tol = 1e-12 * (size(p) + 100) * 10;
      expect(maxDiff3(b.min, { x: a.min.x + by.x, y: a.min.y + by.y, z: a.min.z + by.z })).toBeLessThanOrEqual(tol);
      expect(maxDiff3(b.max, { x: a.max.x + by.x, y: a.max.y + by.y, z: a.max.z + by.z })).toBeLessThanOrEqual(tol);
    }), runs(RUNS));
  }, T);
});
