/**
 * A scene for the kernel's own tests: three unit solids in a row, no colors
 * and no primitive kinds. The kernel is not supposed to know what a node looks
 * like, so its fixture does not say.
 */

import { IDENTITY_POSE_COMPOSITION, createScene, type NodeId, type PoseComposition } from '@weasel-js/core';
import { aabbAround, add, quatFromAxisAngle, type Aabb, type Vec3 } from '@weasel-js/geom/3d';
import { pose3, aabbOfPose, type Pose3 } from './pose3';
import type { Node3d, Scene3d } from './deps';

/** `round` bounds itself the way a sphere does — the same under any rotation. */
export interface TestData {
  round?: boolean;
}

export type TestLayer = 'solids';
export type TestScene = Scene3d<TestData, TestLayer>;
export type TestNode = Node3d<TestData, TestLayer>;

export function boundsOfTestNode(node: TestNode): Aabb {
  if (!node.data.round) return aabbOfPose(node.pose);
  const s = node.pose.scale;
  return aabbAround(
    node.pose.position,
    0.5 * Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z)),
  );
}

export function createTestScene(): TestScene {
  return createScene<TestData, TestLayer, Pose3>({ composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'solids' }],
    initial: [
      { kind: 'mark', layer: 'solids', pose: pose3({ x: -2.2, y: 0.5, z: 0 }), data: {} },
      {
        kind: 'mark',
        layer: 'solids',
        pose: pose3({ x: 0, y: 0.5, z: 0 }, { x: 1.4, y: 1.4, z: 1.4 }),
        data: { round: true },
      },
      {
        kind: 'mark',
        layer: 'solids',
        pose: pose3({ x: 2.2, y: 0.75, z: -1 }, { x: 1, y: 1.5, z: 1 }),
        data: {},
      },
    ],
  });
}

/** The angle of a rotation about +y, the only kind the framed fixture holds. */
const yawOf = (pose: Pose3) => 2 * Math.atan2(pose.rotation[1], pose.rotation[3]);
const yawed = (v: Vec3, a: number): Vec3 => ({
  x: v.x * Math.cos(a) + v.z * Math.sin(a), y: v.y, z: -v.x * Math.sin(a) + v.z * Math.cos(a),
});

/** A container composition for poses turned only about +y and unscaled frames:
 *  a child's position is turned and offset by its frame, its turn added on. */
export const YAW_POSE_COMPOSITION: PoseComposition<Pose3> = {
  compose: (parent, child) => ({
    ...child,
    position: add(parent.position, yawed(child.position, yawOf(parent))),
    rotation: quatFromAxisAngle({ x: 0, y: 1, z: 0 }, yawOf(parent) + yawOf(child)),
  }),
  decompose: (parent, world) => {
    const p = world.position;
    const q = parent.position;
    return {
      ...world,
      position: yawed({ x: p.x - q.x, y: p.y - q.y, z: p.z - q.z }, -yawOf(parent)),
      rotation: quatFromAxisAngle({ x: 0, y: 1, z: 0 }, yawOf(world) - yawOf(parent)),
    };
  },
  closure: 'rigid',
};

/**
 * The test solids under container composition: the first and second at the
 * root, the third stored in a container turned a quarter about +y and raised.
 * Its world pose is the third solid's in {@link createTestScene}.
 */
export function createFramedTestScene(): { scene: TestScene; framed: NodeId; frame: NodeId } {
  const plain = createTestScene();
  const [a, b, c] = [...plain.renderOrder()].map((id) => plain.get(id)!);
  const scene = createScene<TestData, TestLayer, Pose3>({ composition: YAW_POSE_COMPOSITION,
    systemLayers: [{ id: 'solids' }],
  });
  for (const n of [a!, b!]) scene.add({ kind: 'mark', layer: 'solids', pose: n.pose, data: n.data });
  const framePose = pose3({ x: 1, y: 0.25, z: 0.5 }, undefined, quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2));
  const frame = scene.add({ kind: 'group', layer: 'solids', pose: framePose, data: {} });
  const framed = scene.add({
    kind: 'mark', layer: 'solids', parent: frame, pose: YAW_POSE_COMPOSITION.decompose(framePose, c!.pose), data: c!.data,
  });
  return { scene, framed, frame };
}
