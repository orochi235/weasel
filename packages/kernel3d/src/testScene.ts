/**
 * A scene for the kernel's own tests: three unit solids in a row, no colors
 * and no primitive kinds. The kernel is not supposed to know what a node looks
 * like, so its fixture does not say.
 */

import { createScene } from '@weasel-js/core';
import { aabbAround, type Aabb } from '@weasel-js/geom/3d';
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
    0.5 * Math.max(Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2])),
  );
}

export function createTestScene(): TestScene {
  return createScene<TestData, TestLayer, Pose3>({
    systemLayers: [{ id: 'solids' }],
    initial: [
      { kind: 'leaf', layer: 'solids', pose: pose3([-2.2, 0.5, 0]), data: {} },
      { kind: 'leaf', layer: 'solids', pose: pose3([0, 0.5, 0], [1.4, 1.4, 1.4]), data: { round: true } },
      { kind: 'leaf', layer: 'solids', pose: pose3([2.2, 0.75, -1], [1, 1.5, 1]), data: {} },
    ],
  });
}
