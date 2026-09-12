import { describe, it, expect } from 'vitest';
import { aabbOfSolid, createSolidScene, pose3 } from './scene3d';
import { quatFromAxisAngle, type Vec3 } from './math3d';

function expectVecClose(a: Vec3, b: Vec3, digits = 5) {
  for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i], digits);
}

describe('aabbOfSolid', () => {
  it('bounds a unit box at the origin', () => {
    const { min, max } = aabbOfSolid(pose3([0, 0, 0]), 'box');
    expectVecClose(min, [-0.5, -0.5, -0.5]);
    expectVecClose(max, [0.5, 0.5, 0.5]);
  });

  it('follows the position', () => {
    const { min, max } = aabbOfSolid(pose3([10, -3, 2]), 'box');
    expectVecClose(min, [9.5, -3.5, 1.5]);
    expectVecClose(max, [10.5, -2.5, 2.5]);
  });

  it('grows with scale', () => {
    const { min, max } = aabbOfSolid(pose3([0, 0, 0], [2, 4, 6]), 'box');
    expectVecClose(min, [-1, -2, -3]);
    expectVecClose(max, [1, 2, 3]);
  });

  it('widens a box turned 45 degrees about z', () => {
    const turned = pose3([0, 0, 0], [1, 1, 1], quatFromAxisAngle([0, 0, 1], Math.PI / 4));
    const { min, max } = aabbOfSolid(turned, 'box');
    const half = Math.SQRT1_2; // 0.5 * sqrt(2)
    expect(max[0]).toBeCloseTo(half, 5);
    expect(max[1]).toBeCloseTo(half, 5);
    expect(max[2]).toBeCloseTo(0.5, 5);
    expectVecClose(min, [-half, -half, -0.5]);
  });

  it('leaves a sphere unchanged by rotation', () => {
    const turned = pose3([1, 2, 3], [1, 1, 1], quatFromAxisAngle([1, 1, 0], 1.1));
    const { min, max } = aabbOfSolid(turned, 'sphere');
    expectVecClose(min, [0.5, 1.5, 2.5]);
    expectVecClose(max, [1.5, 2.5, 3.5]);
  });

  it('bounds a squashed sphere by its largest axis', () => {
    const { min, max } = aabbOfSolid(pose3([0, 0, 0], [1, 3, 1]), 'sphere');
    expectVecClose(min, [-1.5, -1.5, -1.5]);
    expectVecClose(max, [1.5, 1.5, 1.5]);
  });
});

describe('createSolidScene', () => {
  it('builds a weasel scene holding 3D poses', () => {
    const scene = createSolidScene();
    const ids = [...scene.renderOrder()];
    expect(ids).toHaveLength(3);
    const first = scene.get(ids[0]);
    expect(first?.pose.position).toHaveLength(3);
    expect(first?.data.kind).toBe('box');
  });

  it('round-trips a 3D pose through setPose and undo', () => {
    const scene = createSolidScene();
    const id = [...scene.renderOrder()][0];
    const before = scene.get(id)!.pose;

    scene.setPose(id, { ...before, position: [5, 6, 7] });
    expectVecClose(scene.get(id)!.pose.position, [5, 6, 7]);

    scene.undo();
    expectVecClose(scene.get(id)!.pose.position, before.position);
  });
});
