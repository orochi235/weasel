/**
 * Align and distribute against a scene whose container pose is a frame.
 *
 * Under `IDENTITY_POSE_COMPOSITION` a local pose and a world pose are the same
 * value, so an align test on an ordinary scene passes whether or not the
 * action composes. These run on `frameFixture`, where they differ.
 */
import { describe, it, expect } from 'vitest';
import { alignLeftAction } from './align';
import { distributeHorizontalAction } from './distribute';
import { RIGID_POSE_COMPOSITION } from 'features/groups/composePose';
import {
  makeFrameFixture,
  expectSamePose,
  FRAME_FIXTURE_IDS,
  type FrameFixtureData,
  type FrameFixtureLayer,
} from 'features/groups/frameFixture';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { ImmediateInvoker } from '../invoker';

const { group, upright, turned } = FRAME_FIXTURE_IDS;
const third = asNodeId('c');

/** The fixture plus a third child, so `distribute` has its three members.
 *  Local (0,0) 20x20 has its center at (10,10), which is (-40,-40) from the
 *  group's; a quarter turn sends that to (40,-40), so the center lands at
 *  (90,10). */
function makeScene(withThird: boolean) {
  const scene = makeFrameFixture();
  if (withThird) {
    scene.add({
      id: third,
      kind: 'leaf',
      layer: 'main' as FrameFixtureLayer,
      parent: group,
      data: { label: 'third' } as FrameFixtureData,
      pose: { x: 0, y: 0, width: 20, height: 20 },
    });
  }
  return scene as unknown as Scene<unknown, string, unknown>;
}

function selectionOf(ids: NodeId[]) {
  return { get: () => ids };
}

function run(action: typeof alignLeftAction, scene: Scene<unknown, string, unknown>, ids: NodeId[]) {
  (action.invoker as ImmediateInvoker).run(
    { selection: selectionOf(ids), scene, poseComposition: RIGID_POSE_COMPOSITION } as never,
  );
}

function poseOf(scene: Scene<unknown, string, unknown>, id: NodeId): RectPose {
  return scene.get(id)!.pose as RectPose;
}

describe('alignLeftAction under a container frame', () => {
  it('aligns to the world left edge and stores the result in the group frame', () => {
    const scene = makeScene(false);
    run(alignLeftAction, scene, [upright, turned]);
    // World left edges are 70 (the turned child `a`) and 10 (`b`), so `a`
    // moves 60 to the left in world. Rebased into the group's quarter-turned
    // frame that is a move DOWN the local y axis.
    expectSamePose(poseOf(scene, upright), { x: 10, y: 80, width: 20, height: 10, rotation: 0 });
    expectSamePose(poseOf(scene, turned), { x: 40, y: 60, width: 40, height: 20, rotation: Math.PI / 2 });
  });

  it('does not drift when the same align runs twice', () => {
    const scene = makeScene(false);
    run(alignLeftAction, scene, [upright, turned]);
    const after = poseOf(scene, upright);
    run(alignLeftAction, scene, [upright, turned]);
    expectSamePose(poseOf(scene, upright), after);
  });
});

describe('distributeHorizontalAction under a container frame', () => {
  it('spaces centers along the world x axis', () => {
    const scene = makeScene(true);
    run(distributeHorizontalAction, scene, [upright, turned, third]);
    // World centers: b at 30, a at 75, c at 90. Evenly spaced puts a's center
    // at 60, so it moves 15 to the left in world; b and c are the endpoints.
    expectSamePose(poseOf(scene, upright), { x: 10, y: 35, width: 20, height: 10, rotation: 0 });
    expectSamePose(poseOf(scene, turned), { x: 40, y: 60, width: 40, height: 20, rotation: Math.PI / 2 });
    expect(poseOf(scene, third)).toEqual({ x: 0, y: 0, width: 20, height: 20 });
  });

  it('does not drift when the same distribute runs twice', () => {
    const scene = makeScene(true);
    run(distributeHorizontalAction, scene, [upright, turned, third]);
    const after = poseOf(scene, upright);
    run(distributeHorizontalAction, scene, [upright, turned, third]);
    expectSamePose(poseOf(scene, upright), after);
  });
});
