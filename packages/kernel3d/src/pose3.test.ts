import { describe, expect, it } from 'vitest';
import { sceneFromJSON } from '@weasel-js/core';
import { quatFromAxisAngle } from '@weasel-js/geom/3d';
import { aabbOfPose, pose3, UNIT_CUBE, type Pose3 } from './pose3';
import { createTestScene, type TestData, type TestLayer } from './testScene';

describe('aabbOfPose', () => {
  it('carries a unit primitive to where its pose puts it', () => {
    const box = aabbOfPose(pose3([3, 1, -2]));
    expect(box.min).toEqual([2.5, 0.5, -2.5]);
    expect(box.max).toEqual([3.5, 1.5, -1.5]);
  });

  it('scales before translating', () => {
    const box = aabbOfPose(pose3([0, 0, 0], [4, 1, 1]));
    expect(box.max[0] - box.min[0]).toBeCloseTo(4, 9);
    expect(box.max[1] - box.min[1]).toBeCloseTo(1, 9);
  });

  it('widens under rotation — an AABB cannot be oriented', () => {
    const spun = aabbOfPose(pose3([0, 0, 0], [1, 1, 1], quatFromAxisAngle([0, 0, 1], Math.PI / 4)));
    expect(spun.max[0]).toBeCloseTo(Math.SQRT1_2, 9);
  });

  it('takes the local box it is given', () => {
    const tall = aabbOfPose(pose3([0, 0, 0]), { min: [-0.5, -3, -0.5], max: [0.5, 3, 0.5] });
    expect(tall.max[1] - tall.min[1]).toBeCloseTo(6, 9);
    expect(UNIT_CUBE.max[1] - UNIT_CUBE.min[1]).toBe(1);
  });
});

describe('a quaternion pose in core Scene', () => {
  it('round-trips through setPose and undo', () => {
    const scene = createTestScene();
    const id = [...scene.renderOrder()][0];
    const before = scene.get(id)!.pose;
    const after = pose3([9, 9, 9], [2, 2, 2], quatFromAxisAngle([0, 1, 0], 1));

    scene.setPose(id, after);
    expect(scene.get(id)!.pose).toEqual(after);
    scene.undo();
    expect(scene.get(id)!.pose).toEqual(before);
  });

  /**
   * The claim that `Scene` is dimension-neutral was only ever run against
   * `setPose` and undo. Serialization is where a pose is most likely to be
   * special-cased, and nothing asserted this until now.
   */
  it('survives toJSON and sceneFromJSON with its quaternion intact', () => {
    const scene = createTestScene();
    const id = [...scene.renderOrder()][0];
    const turned = pose3([1.5, 0.5, -3], [2, 0.5, 1], quatFromAxisAngle([0.3, 1, 0], 0.9));
    scene.setPose(id, turned);

    const json = JSON.parse(JSON.stringify(scene.toJSON()));
    const reloaded = sceneFromJSON<TestData, TestLayer, Pose3>(json);
    const pose = reloaded.get([...reloaded.renderOrder()][0])!.pose;

    expect(pose.position).toEqual(turned.position);
    expect(pose.scale).toEqual(turned.scale);
    expect(pose.rotation).toEqual(turned.rotation);
    // Arrays, not class instances: `structuredClone` keeps a class's data and
    // drops its prototype without throwing, so a `Vector3` here would come back
    // as a bare object whose first method call fails far from the cause.
    expect(Array.isArray(pose.rotation)).toBe(true);
  });
});
