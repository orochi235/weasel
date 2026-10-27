import { describe, expect, it } from 'vitest';
import { add, multiply, quatFromAxisAngle, type Aabb, type Mat4, type Vec3 } from '@weasel-js/geom/3d';
import { createCamera } from './camera';
import { POSE3_COMPOSITION } from './composePose3';
import { createAreaSelect, createNodeAtPoint, screenBoxOf, worldPoseOf } from './deps';
import { aabbOfPose, pose3, poseMatrix, type Pose3 } from './pose3';
import { projectPoint, type Viewport3d } from './project';
import { snapBoxes } from './snap/boxIndex';
import { subjectOf } from './snap/probes3d';
import { boundsOfTestNode, createNestedTestScene, type TestScene } from './testScene';
import type { World3d } from './world';

function viewport(): Viewport3d {
  return {
    camera: createCamera({ distance: 14, pitch: 0.5, yaw: 0.4, target: { x: 0.5, y: 0.5, z: -1 } }),
    width: 800,
    height: 600,
  };
}

function worldOf(scene: TestScene, bounds = true): World3d<object, 'solids'> {
  return { scene, viewport, ...(bounds ? { bounds: boundsOfTestNode } : {}) };
}

const center = (b: Aabb): Vec3 => ({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 });

function expectPoseClose(a: Pose3, b: Pose3, digits = 12) {
  for (const k of ['x', 'y', 'z'] as const) {
    expect(a.position[k]).toBeCloseTo(b.position[k], digits);
    expect(a.scale[k]).toBeCloseTo(b.scale[k], digits);
  }
  for (let i = 0; i < 4; i++) expect(a.rotation[i]).toBeCloseTo(b.rotation[i]!, digits);
}

function expectMatClose(a: Mat4, b: Mat4) {
  for (let i = 0; i < 16; i++) expect(a[i]).toBeCloseTo(b[i]!, 12);
}

describe('POSE3_COMPOSITION', () => {
  const parent = pose3({ x: 1, y: -2, z: 3 }, { x: 2, y: 2, z: 2 }, quatFromAxisAngle({ x: 0.2, y: 1, z: 0.4 }, 0.9));
  const child = pose3({ x: 0.5, y: 1.5, z: -0.7 }, { x: 1, y: 3, z: 0.5 }, quatFromAxisAngle({ x: 1, y: 0, z: 0.3 }, -1.2));

  it('composes as the matrix product under a uniformly scaled frame', () => {
    expectMatClose(poseMatrix(POSE3_COMPOSITION.compose(parent, child)), multiply(poseMatrix(parent), poseMatrix(child)));
  });

  it('undoes compose with decompose, under a non-uniform frame too', () => {
    const stretched = { ...parent, scale: { x: 1, y: 3, z: 0.25 } };
    for (const frame of [parent, stretched]) {
      expectPoseClose(POSE3_COMPOSITION.decompose(frame, POSE3_COMPOSITION.compose(frame, child)), child);
      expectPoseClose(POSE3_COMPOSITION.compose(frame, POSE3_COMPOSITION.decompose(frame, child)), child);
    }
  });

  it('places a child exactly under a non-uniform frame, keeping the child its own axes', () => {
    const stretched = { ...parent, scale: { x: 1, y: 3, z: 0.25 } };
    const world = POSE3_COMPOSITION.compose(stretched, child);
    const m = multiply(poseMatrix(stretched), poseMatrix(child));
    expect(world.position.x).toBeCloseTo(m[12]!, 12);
    expect(world.position.y).toBeCloseTo(m[13]!, 12);
    expect(world.position.z).toBeCloseTo(m[14]!, 12);
  });
});

describe('a solid two containers deep', () => {
  function nested() {
    const s = createNestedTestScene();
    const deepWorld = worldPoseOf(s.scene, s.deep)!;
    return { ...s, deepWorld, deepBox: aabbOfPose(deepWorld) };
  }

  it('is drawn at the pose its frames fold to', () => {
    const { scene, outer, inner, deep, deepWorld } = nested();
    const chain = [outer, inner, deep].map((id) => poseMatrix(scene.get(id)!.pose));
    expectMatClose(poseMatrix(deepWorld), multiply(multiply(chain[0]!, chain[1]!), chain[2]!));
    expect(deepWorld.position.x).toBeGreaterThan(4);
  });

  it('is drawn where a gesture holds its container', () => {
    const { scene, outer, deep, deepWorld } = nested();
    const shift = { x: 0, y: 0, z: 3 };
    const held = scene.get(outer)!.pose;
    scene.overrides.set(outer, { pose: { ...held, position: add(held.position, shift) } });
    expect(worldPoseOf(scene, deep)!.position.z).toBeCloseTo(deepWorld.position.z + 3, 12);
  });

  it('is picked at its world position, not its stored one', () => {
    const { scene, deep, deepBox } = nested();
    const pick = createNodeAtPoint(worldOf(scene));
    expect(pick(projectPoint(center(deepBox), viewport())!)).toBe(deep);
    expect(pick(projectPoint(scene.get(deep)!.pose.position, viewport())!)).not.toBe(deep);
  });

  it('is picked where a gesture holds its container', () => {
    const { scene, outer, deep, deepBox } = nested();
    const pick = createNodeAtPoint(worldOf(scene));
    const shift = { x: 0, y: 0, z: 3 };
    const at = projectPoint(add(center(deepBox), shift), viewport())!;
    expect(pick(at)).not.toBe(deep);
    const held = scene.get(outer)!.pose;
    scene.overrides.set(outer, { pose: { ...held, position: add(held.position, shift) } });
    expect(pick(at)).toBe(deep);
  });

  it('has its world box in screenBoxOf and the marquee', () => {
    const { scene, deep, deepBox } = nested();
    const world = worldOf(scene);
    const box = screenBoxOf(world, deep, viewport())!;
    const at = projectPoint(center(deepBox), viewport())!;
    expect(at.x).toBeGreaterThan(box.x);
    expect(at.x).toBeLessThan(box.x + box.width);
    const marquee = createAreaSelect(world, { get: () => [], set: () => {} });
    expect(marquee.hitTestArea({ x: at.x - 1, y: at.y - 1, width: 2, height: 2 })).toEqual([deep]);
  });

  it('leaves its containers unpicked: they draw nothing, with or without a bounds function', () => {
    const { scene, outer, inner } = nested();
    for (const bounds of [true, false]) {
      const pick = createNodeAtPoint(worldOf(scene, bounds));
      for (const id of [outer, inner]) {
        expect(pick(projectPoint(worldPoseOf(scene, id)!.position, viewport())!)).toBeNull();
      }
    }
  });

  it('is a snap target at its world box, and its containers are none', () => {
    const { scene, root, deepBox } = nested();
    const world = worldOf(scene);
    const all = [-100, -100, -100, 100, 100, 100];
    const expected = [aabbOfPose(scene.get(root)!.pose), deepBox];
    // The first read scans, the second builds the index, the third reads it.
    for (const near of [[all], [all], [all]]) {
      const boxes = snapBoxes(world, [], near);
      expect(boxes).toHaveLength(2);
      boxes.forEach((b, i) => {
        expectPoseClose(pose3(b.min), pose3(expected[i]!.min));
        expectPoseClose(pose3(b.max), pose3(expected[i]!.max));
      });
    }
  });

  it('is no snap target for a move of a container it rides in', () => {
    const { scene, root, outer, inner } = nested();
    const world = worldOf(scene);
    const all = [-100, -100, -100, 100, 100, 100];
    for (const moved of [outer, inner, outer]) {
      expect(snapBoxes(world, [moved], [all])).toEqual([aabbOfPose(scene.get(root)!.pose)]);
    }
  });

  it('is what a move of its container drags, cast from the container', () => {
    const { scene, outer, deepBox } = nested();
    const subject = subjectOf(worldOf(scene), [outer], { x: 0, y: 1, z: 0 })!;
    expect(subject.box).toEqual(deepBox);
    expect(subject.anchor.height).toBe(1);
    expect(subject.anchor.box).toEqual({ min: { x: 2, y: 1, z: -1 }, max: { x: 2, y: 1, z: -1 } });
  });
});
