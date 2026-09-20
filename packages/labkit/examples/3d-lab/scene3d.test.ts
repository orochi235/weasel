import { describe, it, expect } from 'vitest';
import { aabbOfSolid, createSolidScene, pose3 } from './scene3d';
import { quatFromAxisAngle, type Vec3 } from '@weasel-js/geom/3d';

function expectVecClose(a: Vec3, b: Vec3, digits = 5) {
  for (const axis of ['x', 'y', 'z'] as const) expect(a[axis]).toBeCloseTo(b[axis], digits);
}

describe('aabbOfSolid', () => {
  it('bounds a unit box at the origin', () => {
    const { min, max } = aabbOfSolid(pose3({ x: 0, y: 0, z: 0 }), 'box');
    expectVecClose(min, { x: -0.5, y: -0.5, z: -0.5 });
    expectVecClose(max, { x: 0.5, y: 0.5, z: 0.5 });
  });

  it('follows the position', () => {
    const { min, max } = aabbOfSolid(pose3({ x: 10, y: -3, z: 2 }), 'box');
    expectVecClose(min, { x: 9.5, y: -3.5, z: 1.5 });
    expectVecClose(max, { x: 10.5, y: -2.5, z: 2.5 });
  });

  it('grows with scale', () => {
    const { min, max } = aabbOfSolid(pose3({ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 }), 'box');
    expectVecClose(min, { x: -1, y: -2, z: -3 });
    expectVecClose(max, { x: 1, y: 2, z: 3 });
  });

  it('widens a box turned 45 degrees about z', () => {
    const turned = pose3(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
      quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 4),
    );
    const { min, max } = aabbOfSolid(turned, 'box');
    const half = Math.SQRT1_2; // 0.5 * sqrt(2)
    expect(max.x).toBeCloseTo(half, 5);
    expect(max.y).toBeCloseTo(half, 5);
    expect(max.z).toBeCloseTo(0.5, 5);
    expectVecClose(min, { x: -half, y: -half, z: -0.5 });
  });

  it('leaves a sphere unchanged by rotation', () => {
    const turned = pose3(
      { x: 1, y: 2, z: 3 },
      { x: 1, y: 1, z: 1 },
      quatFromAxisAngle({ x: 1, y: 1, z: 0 }, 1.1),
    );
    const { min, max } = aabbOfSolid(turned, 'sphere');
    expectVecClose(min, { x: 0.5, y: 1.5, z: 2.5 });
    expectVecClose(max, { x: 1.5, y: 2.5, z: 3.5 });
  });

  it('bounds a squashed sphere by its largest axis', () => {
    const { min, max } = aabbOfSolid(pose3({ x: 0, y: 0, z: 0 }, { x: 1, y: 3, z: 1 }), 'sphere');
    expectVecClose(min, { x: -1.5, y: -1.5, z: -1.5 });
    expectVecClose(max, { x: 1.5, y: 1.5, z: 1.5 });
  });
});

describe('createSolidScene', () => {
  it('builds a weasel scene holding 3D poses', () => {
    const scene = createSolidScene();
    const ids = [...scene.renderOrder()];
    expect(ids).toHaveLength(3);
    const first = scene.get(ids[0]);
    expect(Object.keys(first!.pose.position)).toEqual(['x', 'y', 'z']);
    expect(first?.data.kind).toBe('box');
  });

  it('round-trips a 3D pose through setPose and undo', () => {
    const scene = createSolidScene();
    const id = [...scene.renderOrder()][0];
    const before = scene.get(id)!.pose;

    scene.setPose(id, { ...before, position: { x: 5, y: 6, z: 7 } });
    expectVecClose(scene.get(id)!.pose.position, { x: 5, y: 6, z: 7 });

    scene.undo();
    expectVecClose(scene.get(id)!.pose.position, before.position);
  });
});
