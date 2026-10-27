/**
 * A scene for the kernel's own tests: three unit solids in a row, no colors
 * and no primitive kinds. The kernel is not supposed to know what a node looks
 * like, so its fixture does not say.
 */

import { IDENTITY_POSE_COMPOSITION, createScene, type NodeId } from '@weasel-js/core';
import { aabbAround, quatFromAxisAngle, type Aabb } from '@weasel-js/geom/3d';
import { POSE3_COMPOSITION } from './composePose3';
import { pose3, aabbOfPose, type Pose3 } from './pose3';
import type { Node3d, Scene3d } from './deps';

/** `round` bounds itself the way a sphere does — the same under any rotation.
 *  A group draws nothing, so it occupies nothing. */
export interface TestData {
  round?: boolean;
}

export type TestLayer = 'solids';
export type TestScene = Scene3d<TestData, TestLayer>;
export type TestNode = Node3d<TestData, TestLayer>;

export function boundsOfTestNode(node: TestNode): Aabb | null {
  if (node.kind === 'group') return null;
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

/**
 * The test solids under container composition: the first and second at the
 * root, the third stored in a container turned a quarter about +y and raised.
 * Its world pose is the third solid's in {@link createTestScene}.
 */
export function createFramedTestScene(): { scene: TestScene; framed: NodeId; frame: NodeId } {
  const plain = createTestScene();
  const [a, b, c] = [...plain.renderOrder()].map((id) => plain.get(id)!);
  const scene = createScene<TestData, TestLayer, Pose3>({ composition: POSE3_COMPOSITION,
    systemLayers: [{ id: 'solids' }],
  });
  for (const n of [a!, b!]) scene.add({ kind: 'mark', layer: 'solids', pose: n.pose, data: n.data });
  const framePose = pose3({ x: 1, y: 0.25, z: 0.5 }, undefined, quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2));
  const frame = scene.add({ kind: 'group', layer: 'solids', pose: framePose, data: {} });
  const framed = scene.add({
    kind: 'mark', layer: 'solids', parent: frame, pose: POSE3_COMPOSITION.decompose(framePose, c!.pose), data: c!.data,
  });
  return { scene, framed, frame };
}

/**
 * A solid two containers deep, beside one at the root: `outer` is turned about
 * +y, doubled and raised; `inner`, inside it, is tipped about +x and offset;
 * `deep` sits in `inner` at a local position that is nowhere near its world
 * one.
 */
export function createNestedTestScene(): { scene: TestScene; root: NodeId; outer: NodeId; inner: NodeId; deep: NodeId } {
  const scene = createScene<TestData, TestLayer, Pose3>({ composition: POSE3_COMPOSITION,
    systemLayers: [{ id: 'solids' }],
  });
  const root = scene.add({ kind: 'mark', layer: 'solids', pose: pose3({ x: -3, y: 0.5, z: 0 }), data: {} });
  const outer = scene.add({
    kind: 'group', layer: 'solids', data: {},
    pose: pose3({ x: 2, y: 1, z: -1 }, { x: 2, y: 2, z: 2 }, quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)),
  });
  const inner = scene.add({
    kind: 'group', layer: 'solids', parent: outer, data: {},
    pose: pose3({ x: 0.5, y: 0, z: 0.25 }, undefined, quatFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 6)),
  });
  const deep = scene.add({
    kind: 'mark', layer: 'solids', parent: inner, data: {},
    pose: pose3({ x: 0, y: 0.5, z: 0.75 }, { x: 0.5, y: 0.25, z: 0.5 }),
  });
  return { scene, root, outer, inner, deep };
}
