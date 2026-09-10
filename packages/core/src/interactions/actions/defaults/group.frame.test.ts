/**
 * Group and ungroup against a scene whose container pose is a frame. See
 * `alignDistribute.frame.test.ts` for why the fixture is needed at all.
 *
 * Grouping and ungrouping must not move anything on screen, so every
 * assertion here is that a member's WORLD pose survived the change of frame.
 */
import { describe, it, expect, vi } from 'vitest';
import { groupAction, ungroupAction } from './group';
import { RIGID_POSE_COMPOSITION } from 'features/groups/composePose';
import {
  makeFrameFixture,
  expectSamePose,
  FRAME_FIXTURE_IDS,
  FRAME_FIXTURE_WORLD,
} from 'features/groups/frameFixture';
import { scenePoseFrame } from '../poseFrame';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { ImmediateInvoker } from '../invoker';

const { group, upright, turned } = FRAME_FIXTURE_IDS;

function makeScene() {
  return makeFrameFixture() as unknown as Scene<unknown, string, unknown>;
}

function run(
  action: typeof groupAction,
  scene: Scene<unknown, string, unknown>,
  ids: NodeId[],
) {
  const set = vi.fn();
  (action.invoker as ImmediateInvoker).run(
    {
      selection: { get: () => ids, set },
      scene,
      poseComposition: RIGID_POSE_COMPOSITION,
    } as never,
  );
  return set;
}

function worldOf(scene: Scene<unknown, string, unknown>, id: NodeId): RectPose {
  return scenePoseFrame(scene, RIGID_POSE_COMPOSITION).world(id) as RectPose;
}

describe('groupAction under a container frame', () => {
  it('leaves every member where it was on screen', () => {
    const scene = makeScene();
    run(groupAction, scene, [upright, turned]);
    expectSamePose(worldOf(scene, upright), FRAME_FIXTURE_WORLD.a);
    expectSamePose(worldOf(scene, turned), FRAME_FIXTURE_WORLD.b);
  });

  it('gives the new container the world envelope of the ink it holds', () => {
    const scene = makeScene();
    const set = run(groupAction, scene, [upright, turned]);
    const containerId = set.mock.calls[0][0][0] as NodeId;
    // World AABBs (70,10,10,20) and (10,50,40,20) envelope to (10,10,70,60);
    // the turned member's ink is what makes it 70 wide rather than 20.
    expectSamePose(worldOf(scene, containerId), { x: 10, y: 10, width: 70, height: 60 });
    expect(scene.get(containerId)!.parent).toBe(group);
  });

  it('does not derive the container pose from poses expressed inside it', () => {
    const scene = makeScene();
    const set = run(groupAction, scene, [upright, turned]);
    const containerId = set.mock.calls[0][0][0] as NodeId;
    expect(scene.get(containerId)!.derivePose).toBeUndefined();
  });
});

describe('ungroupAction under a container frame', () => {
  it('rebases every freed child into the frame it lands in', () => {
    const scene = makeScene();
    run(ungroupAction, scene, [group]);
    expect(scene.get(upright)!.parent).toBeNull();
    expectSamePose(scene.get(upright)!.pose as RectPose, FRAME_FIXTURE_WORLD.a);
    expectSamePose(scene.get(turned)!.pose as RectPose, FRAME_FIXTURE_WORLD.b);
  });
});
