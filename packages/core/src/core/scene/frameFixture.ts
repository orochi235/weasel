/**
 * The scene every consumer migrated to world poses is checked against.
 *
 * It exists because **under `IDENTITY_POSE_COMPOSITION` a local pose and a
 * world pose are the same value**, so a test written against a default scene
 * passes whether or not the consumer composes. Anything asserting that a
 * consumer reads world coordinates has to run against a scene where the two
 * differ, and this is that scene.
 *
 * Shape: a container turned 90° holding two children at non-zero local
 * offsets, one of them turned again. The right angle is deliberate — it makes
 * every expected coordinate an integer, so a wrong answer is obvious rather
 * than nearly right.
 */
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose, type Scene } from 'core/scene/types';

export interface FrameFixtureData {
  label: string;
}

export type FrameFixtureLayer = 'main';

export const FRAME_FIXTURE_IDS = {
  group: asNodeId('g'),
  upright: asNodeId('a'),
  turned: asNodeId('b'),
} as const;

/**
 * World poses each node must resolve to under `RIGID_POSE_COMPOSITION`,
 * derived by hand rather than from the code under test.
 *
 * The group occupies (0,0)-(100,100) and is turned a quarter turn about its
 * center (50,50). A child at local (10,20) with size 20x10 has its center at
 * local (20,25), which is (-30,-25) from the group's center; a quarter turn
 * sends that offset to (25,-30), so the center lands at (75,20).
 */
export const FRAME_FIXTURE_WORLD: Record<string, RectPose> = {
  a: { x: 65, y: 15, width: 20, height: 10, rotation: Math.PI / 2 },
  // Local center (60,70) is (10,20) from the group's; a quarter turn sends
  // that to (-20,10), so the center lands at (30,60) and the rotations sum.
  b: { x: 10, y: 50, width: 40, height: 20, rotation: Math.PI },
};

/** The same nodes read as local poses — what `getPose` returns, and what a
 *  consumer that has not been migrated will wrongly use as world. */
export const FRAME_FIXTURE_LOCAL: Record<string, RectPose> = {
  a: { x: 10, y: 20, width: 20, height: 10 },
  b: { x: 40, y: 60, width: 40, height: 20, rotation: Math.PI / 2 },
};

export function makeFrameFixture(): Scene<FrameFixtureData, FrameFixtureLayer, RectPose> {
  const scene = createScene<FrameFixtureData, FrameFixtureLayer, RectPose>({
    systemLayers: [{ id: 'main' }],
  });
  scene.add({
    id: FRAME_FIXTURE_IDS.group,
    kind: 'container',
    layer: 'main',
    data: { label: 'group' },
    pose: { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 },
  });
  scene.add({
    id: FRAME_FIXTURE_IDS.upright,
    kind: 'leaf',
    layer: 'main',
    parent: FRAME_FIXTURE_IDS.group,
    data: { label: 'upright' },
    pose: FRAME_FIXTURE_LOCAL.a,
  });
  scene.add({
    id: FRAME_FIXTURE_IDS.turned,
    kind: 'leaf',
    layer: 'main',
    parent: FRAME_FIXTURE_IDS.group,
    data: { label: 'turned' },
    pose: FRAME_FIXTURE_LOCAL.b,
  });
  return scene;
}

/** Assert two poses describe the same box, to within float noise. */
export function expectSamePose(actual: RectPose, expected: RectPose, tolerance = 1e-9): void {
  const near = (a: number, b: number) => Math.abs(a - b) < tolerance;
  const ok =
    near(actual.x, expected.x) &&
    near(actual.y, expected.y) &&
    near(actual.width, expected.width) &&
    near(actual.height, expected.height) &&
    near(actual.rotation ?? 0, expected.rotation ?? 0);
  if (!ok) {
    throw new Error(
      `pose mismatch\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`,
    );
  }
}
