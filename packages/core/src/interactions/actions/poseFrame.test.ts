import { describe, it, expect } from 'vitest';
import { scenePoseFrame } from './poseFrame';
import { RIGID_POSE_COMPOSITION } from 'features/groups/composePose';
import {
  makeFrameFixture,
  expectSamePose,
  FRAME_FIXTURE_IDS,
  FRAME_FIXTURE_WORLD,
  FRAME_FIXTURE_LOCAL,
} from 'features/groups/frameFixture';
import type { RectPose, Scene } from 'core/scene/types';

function fixtureFrame() {
  const scene = makeFrameFixture();
  return {
    scene,
    frame: scenePoseFrame(
      scene as unknown as Scene<unknown, string, unknown>,
      RIGID_POSE_COMPOSITION,
    ),
  };
}

describe('scenePoseFrame', () => {
  it('composes a child of a turned container to its hand-derived world pose', () => {
    const { frame } = fixtureFrame();
    expectSamePose(frame.world(FRAME_FIXTURE_IDS.upright) as RectPose, FRAME_FIXTURE_WORLD.a);
    expectSamePose(frame.world(FRAME_FIXTURE_IDS.turned) as RectPose, FRAME_FIXTURE_WORLD.b);
  });

  it('rebases a world pose back to the stored local one', () => {
    const { frame } = fixtureFrame();
    for (const id of [FRAME_FIXTURE_IDS.upright, FRAME_FIXTURE_IDS.turned] as const) {
      const back = frame.local(id, frame.world(id)) as RectPose;
      expectSamePose(back, FRAME_FIXTURE_LOCAL[id] as RectPose);
    }
  });

  it('reads an in-flight override, not the stored pose', () => {
    const { scene, frame } = fixtureFrame();
    scene.overrides.set(FRAME_FIXTURE_IDS.upright, { pose: { x: 0, y: 0, width: 20, height: 10 } });
    scene.overrides.commit();
    const world = frame.world(FRAME_FIXTURE_IDS.upright) as RectPose;
    // Local (0,0) 20x10 has its center at (10,5), which is (-40,-45) from the
    // group's; a quarter turn sends that to (45,-40).
    expectSamePose(world, { x: 85, y: 5, width: 20, height: 10, rotation: Math.PI / 2 });
  });

  it('is the identity in both directions with no composition dep', () => {
    const scene = makeFrameFixture();
    const frame = scenePoseFrame(scene as unknown as Scene<unknown, string, unknown>, undefined);
    for (const id of [FRAME_FIXTURE_IDS.upright, FRAME_FIXTURE_IDS.turned] as const) {
      expect(frame.world(id)).toEqual(FRAME_FIXTURE_LOCAL[id]);
      expect(frame.local(id, FRAME_FIXTURE_LOCAL[id])).toEqual(FRAME_FIXTURE_LOCAL[id]);
    }
  });
});
