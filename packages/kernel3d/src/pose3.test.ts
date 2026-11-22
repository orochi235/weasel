import { describe, expect, it } from 'vitest';
import { loadScene } from '@weasel-js/core';
import { quatFromAxisAngle } from '@weasel-js/geom/3d';
import { aabbOfPose, pose3, UNIT_CUBE, withAabb, type Pose3 } from './pose3';
import { createTestScene, type TestData, type TestLayer } from './testScene';

describe('aabbOfPose', () => {
  it('carries a unit primitive to where its pose puts it', () => {
    const box = aabbOfPose(pose3({ x: 3, y: 1, z: -2 }));
    expect(box.min).toEqual({ x: 2.5, y: 0.5, z: -2.5 });
    expect(box.max).toEqual({ x: 3.5, y: 1.5, z: -1.5 });
  });

  it('scales before translating', () => {
    const box = aabbOfPose(pose3({ x: 10, y: 2, z: 0 }, { x: 4, y: 1, z: 1 }));
    expect(box.min).toEqual({ x: 8, y: 1.5, z: -0.5 });
    expect(box.max).toEqual({ x: 12, y: 2.5, z: 0.5 });
  });

  it('widens under rotation — an AABB cannot be oriented', () => {
    const spun = aabbOfPose(
      pose3(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 4),
      ),
    );
    expect(spun.max.x).toBeCloseTo(Math.SQRT1_2, 9);
  });

  it('takes the local box it is given', () => {
    const tall = aabbOfPose(pose3({ x: 0, y: 0, z: 0 }), {
      min: { x: -0.5, y: -3, z: -0.5 },
      max: { x: 0.5, y: 3, z: 0.5 },
    });
    expect(tall.max.y - tall.min.y).toBeCloseTo(6, 9);
    expect(UNIT_CUBE.max.y - UNIT_CUBE.min.y).toBe(1);
  });
});

describe('a quaternion pose in core Scene', () => {
  it('round-trips through setPose and undo', () => {
    const scene = createTestScene();
    const id = [...scene.renderOrder()][0];
    const before = scene.get(id)!.pose;
    const after = pose3(
      { x: 9, y: 9, z: 9 },
      { x: 2, y: 2, z: 2 },
      quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 1),
    );

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
  it('survives toJSON and loadScene with its quaternion intact', () => {
    const scene = createTestScene();
    const id = [...scene.renderOrder()][0];
    const turned = pose3(
      { x: 1.5, y: 0.5, z: -3 },
      { x: 2, y: 0.5, z: 1 },
      quatFromAxisAngle({ x: 0.3, y: 1, z: 0 }, 0.9),
    );
    scene.setPose(id, turned);

    const json = JSON.parse(JSON.stringify(scene.toJSON()));
    const reloaded = loadScene<TestData, TestLayer, Pose3>(json);
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

describe('withAabb', () => {
  it('moves and scales an unrotated pose onto a box exactly', () => {
    const pose = pose3({ x: 3, y: 1, z: -2 }, { x: 2, y: 4, z: 6 });
    const box = { min: { x: 10, y: 20, z: 30 }, max: { x: 14, y: 21, z: 33 } };
    const to = withAabb(pose, box);
    expect(aabbOfPose(to)).toEqual(box);
    expect(to.rotation).toBe(pose.rotation);
  });

  it('keeps the scale exactly when the box only moves, rotated or not', () => {
    const pose = { ...pose3({ x: 3, y: 1, z: -2 }, { x: 2, y: 4, z: 6 }), rotation: quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.4) };
    const now = aabbOfPose(pose);
    const d = { x: 5, y: -2, z: 7 };
    const to = withAabb(pose, {
      min: { x: now.min.x + d.x, y: now.min.y + d.y, z: now.min.z + d.z },
      max: { x: now.max.x + d.x, y: now.max.y + d.y, z: now.max.z + d.z },
    });
    expect(to.scale).toBe(pose.scale);
    for (const axis of ['x', 'y', 'z'] as const) expect(to.position[axis]).toBeCloseTo(pose.position[axis] + d[axis], 9);
  });
});
