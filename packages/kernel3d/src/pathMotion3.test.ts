import { describe, expect, it } from 'vitest';
import type { PoseDescriptor } from '@weasel-js/core/engine';
import { lengthTable3, quatFromAxisAngle, quatRotate, type Vec3 } from '@weasel-js/geom/3d';
import { pathMotion3 } from './pathMotion3';
import { pose3, type Pose3 } from './pose3';

const STUB: PoseDescriptor<Pose3> = {
  getBounds: () => ({ x: 0, y: 0, width: 1, height: 1 }),
  remapBounds: (p) => p,
  fromBounds: (_b, t) => t,
};

/** +x 10, then +z 10. */
const PATH = lengthTable3([{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 10 }]);
const POSE = pose3({ x: 99, y: 99, z: 99 });

const near = (a: Vec3, b: Vec3) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
  expect(a.z).toBeCloseTo(b.z, 9);
};

describe('pathMotion3', () => {
  const motion = pathMotion3(PATH, { descriptor: STUB });

  it('places the position at the path ends and travels by length', () => {
    near(motion.lerp(POSE, POSE, 0).position, { x: 0, y: 0, z: 0 });
    near(motion.lerp(POSE, POSE, 1).position, { x: 10, y: 0, z: 10 });
    near(motion.lerp(POSE, POSE, 0.25).position, { x: 5, y: 0, z: 0 });
    near(motion.lerp(POSE, POSE, 0.75).position, { x: 10, y: 0, z: 5 });
  });

  it('slerps rotation and lerps scale between the poses when not orienting', () => {
    const b = pose3(POSE.position, { x: 3, y: 1, z: 1 }, quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 1));
    const p = motion.lerp(POSE, b, 0.5);
    expect(p.scale.x).toBe(2);
    near(quatRotate(p.rotation, { x: 1, y: 0, z: 0 }), quatRotate(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.5), { x: 1, y: 0, z: 0 }));
  });

  it('turns local +x along the tangent with +y kept up under orient', () => {
    const turning = pathMotion3(PATH, { descriptor: STUB, orient: true });
    const first = turning.lerp(POSE, POSE, 0.25).rotation;
    near(quatRotate(first, { x: 1, y: 0, z: 0 }), { x: 1, y: 0, z: 0 });
    const second = turning.lerp(POSE, POSE, 0.75).rotation;
    near(quatRotate(second, { x: 1, y: 0, z: 0 }), { x: 0, y: 0, z: 1 });
    near(quatRotate(second, { x: 0, y: 1, z: 0 }), { x: 0, y: 1, z: 0 });
  });

  it('applies the offset in the node frame first, and rides on a turned anchor', () => {
    const offset = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);
    const m = pathMotion3(PATH, { descriptor: STUB, orient: true, rotationOffset: offset, anchor: { x: 0, y: 0, z: 1 } });
    const p = m.lerp(POSE, POSE, 0.25);
    // +z turned by the offset is +x, which then faces along the first leg.
    near(quatRotate(p.rotation, { x: 0, y: 0, z: 1 }), { x: 1, y: 0, z: 0 });
    // The anchor, one unit along local +z, sits on the path: the origin is one unit behind it.
    near(p.position, { x: 4, y: 0, z: 0 });
  });

  it('refuses a 2D table', () => {
    expect(() => pathMotion3({ ...PATH, dim: 2 }, { descriptor: STUB })).toThrow(/pathMotion/);
  });
});
