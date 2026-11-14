import { describe, expect, it } from 'vitest';
import { cross, quatFromAxisAngle, quatFromBasis, quatRotate, quatSlerp, type Quat, type Vec3 } from './index';

const near = (a: Vec3, b: Vec3) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
  expect(a.z).toBeCloseTo(b.z, 9);
};

describe('quatFromBasis', () => {
  it('takes each local axis to its basis vector, on every branch of the trace', () => {
    const axes: [number, number, number][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]];
    for (const [ax, ay, az] of axes) {
      for (const angle of [0, 0.7, 2.5, Math.PI]) {
        const q = quatFromAxisAngle({ x: ax, y: ay, z: az }, angle);
        const x = quatRotate(q, { x: 1, y: 0, z: 0 });
        const y = quatRotate(q, { x: 0, y: 1, z: 0 });
        const r = quatFromBasis(x, y, cross(x, y));
        near(quatRotate(r, { x: 1, y: 0, z: 0 }), x);
        near(quatRotate(r, { x: 0, y: 1, z: 0 }), y);
      }
    }
  });
});

describe('quatSlerp', () => {
  const about = (angle: number): Quat => quatFromAxisAngle({ x: 0, y: 0, z: 1 }, angle);
  it('answers its ends and turns at an even rate between them', () => {
    near(quatRotate(quatSlerp(about(0), about(2), 0), { x: 1, y: 0, z: 0 }), { x: 1, y: 0, z: 0 });
    near(quatRotate(quatSlerp(about(0), about(2), 1), { x: 1, y: 0, z: 0 }), { x: Math.cos(2), y: Math.sin(2), z: 0 });
    near(quatRotate(quatSlerp(about(0), about(2), 0.25), { x: 1, y: 0, z: 0 }), { x: Math.cos(0.5), y: Math.sin(0.5), z: 0 });
  });
  it('takes the shorter arc when the two quaternions sit in opposite hemispheres', () => {
    const b = about(0.4).map((n) => -n) as unknown as Quat;
    near(quatRotate(quatSlerp(about(0), b, 0.5), { x: 1, y: 0, z: 0 }), { x: Math.cos(0.2), y: Math.sin(0.2), z: 0 });
  });
});
