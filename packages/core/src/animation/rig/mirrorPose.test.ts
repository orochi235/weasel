import { describe, expect, it } from 'vitest';
import { mat3 } from '../../renderer/math/mat3';
import { mirrorPose } from './mirrorPose';
import { resolveSkeleton } from './resolveSkeleton';
import type { Pose, Skeleton } from './types';

const SKELETON: Skeleton = {
  joints: [
    { name: 'hip', parent: null, bind: { x: 3, y: -1, rotation: 0.2, scaleX: 1, scaleY: 1 } },
    { name: 'torso', parent: 'hip', bind: { x: 0, y: -2, rotation: -Math.PI / 2, scaleX: 1, scaleY: 1 } },
    { name: 'arm', parent: 'torso', bind: { x: 9, y: 0, rotation: 2.8, scaleX: 1.5, scaleY: 0.5 } },
    { name: 'fore', parent: 'arm', bind: { x: 8, y: 1, rotation: 0.4, scaleX: 1, scaleY: 1 } },
  ],
};

const POSE: Pose = {
  hip: { x: 1.5, y: 2 },
  torso: { rotation: 0.3 },
  arm: { rotation: -0.7, scaleX: 1.2 },
  // `fore` is absent: it sits at its bind.
};

/** Reflection across the rig's y axis. */
const FLIP = (() => {
  const m = new Float32Array(9) as Parameters<typeof mat3.multiply>[0];
  m[0] = -1; m[4] = 1; m[8] = 1;
  return m;
})();

describe('mirrorPose', () => {
  it('resolves every joint to the reflection of the original across the root axis', () => {
    const original = resolveSkeleton(SKELETON, POSE);
    const mirrored = resolveSkeleton(SKELETON, mirrorPose(SKELETON, POSE));
    for (const { name } of SKELETON.joints) {
      const want = mat3.multiply(mat3.multiply(FLIP, original.get(name)!), FLIP);
      const got = mirrored.get(name)!;
      for (let i = 0; i < 9; i++) expect(got[i], `${name}[${i}]`).toBeCloseTo(want[i], 5);
    }
  });

  it('is its own inverse', () => {
    const twice = mirrorPose(SKELETON, mirrorPose(SKELETON, POSE));
    const a = resolveSkeleton(SKELETON, POSE);
    const b = resolveSkeleton(SKELETON, twice);
    for (const { name } of SKELETON.joints) {
      for (let i = 0; i < 9; i++) expect(b.get(name)![i], `${name}[${i}]`).toBeCloseTo(a.get(name)![i], 5);
    }
    expect(twice.hip!.x).toBeCloseTo(POSE.hip!.x!, 12);
    expect(twice.torso!.rotation).toBeCloseTo(POSE.torso!.rotation!, 12);
  });

  it('mirrors a joint the pose leaves at its bind', () => {
    expect(mirrorPose(SKELETON, {}).fore).toEqual({ x: -16, rotation: -0.8 });
  });

  it('leaves y and scale alone', () => {
    const out = mirrorPose(SKELETON, POSE);
    expect(out.hip!.y).toBe(2);
    expect(out.arm!.scaleX).toBe(1.2);
    expect(out.arm!.scaleY).toBeUndefined();
  });

  it('mirrors a joint the skeleton does not name against an identity bind', () => {
    expect(mirrorPose(SKELETON, { tail: { x: 4, rotation: 1 } }).tail).toEqual({ x: -4, rotation: -1 });
  });
});
