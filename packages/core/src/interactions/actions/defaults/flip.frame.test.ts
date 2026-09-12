/**
 * Flip against a scene whose container pose is a frame. See
 * `alignDistribute.frame.test.ts` for why the fixture is needed at all.
 */
import { describe, it, expect, vi } from 'vitest';
import { flipAction } from './flip';
import { RIGID_POSE_COMPOSITION } from 'features/groups/composePose';
import {
  makeFrameFixture,
  expectSamePose,
  FRAME_FIXTURE_IDS,
  FRAME_FIXTURE_LOCAL,
} from 'features/groups/frameFixture';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { ImmediateInvoker } from '../invoker';
import type { Mat3 } from '@weasel-js/geom';

const { upright, turned } = FRAME_FIXTURE_IDS;

function makeScene() {
  return makeFrameFixture() as unknown as Scene<unknown, string, unknown>;
}

function run(
  scene: Scene<unknown, string, unknown>,
  ids: NodeId[],
  extraDeps: Record<string, unknown> = {},
) {
  (flipAction.invoker as ImmediateInvoker).run(
    {
      selection: { get: () => ids },
      scene,
      poseComposition: RIGID_POSE_COMPOSITION,
      ...extraDeps,
    } as never,
    { axis: 'x', pivot: 'union' },
  );
}

function poseOf(scene: Scene<unknown, string, unknown>, id: NodeId): RectPose {
  return scene.get(id)!.pose as RectPose;
}

describe('flipAction under a container frame', () => {
  it('mirrors about the world union and stores the result in the group frame', () => {
    const scene = makeScene();
    run(scene, [upright, turned]);
    // World visual bounds are (70,10,10,20) and (10,50,40,20), so the union
    // spans x 10..80 and the mirror line is x = 45. A mirror reverses the
    // sense of a turn, so both rotations come back negated and then rebased.
    expectSamePose(poseOf(scene, upright), { x: 10, y: 80, width: 20, height: 10, rotation: -Math.PI });
    expectSamePose(poseOf(scene, turned), { x: 40, y: 30, width: 40, height: 20, rotation: -3 * Math.PI / 2 });
  });

  it('returns every member to where it started when flipped twice', () => {
    const scene = makeScene();
    run(scene, [upright, turned]);
    run(scene, [upright, turned]);
    expectSamePose(poseOf(scene, upright), FRAME_FIXTURE_LOCAL.a);
    expectSamePose(poseOf(scene, turned), FRAME_FIXTURE_LOCAL.b);
  });

  it('hands the geometry seam the mirror as the node itself sees it', () => {
    const scene = makeScene();
    const seen: Mat3[] = [];
    const geometryProjection = {
      transform: vi.fn((_node: unknown, m: Mat3) => { seen.push(m); return null; }),
    };
    run(scene, [upright], { geometryProjection });
    // A one-member union is that member's own visual box, so the world mirror
    // line is x = 75. It lands at local y = 25 in a frame turned a quarter
    // turn, and a world-x mirror seen from there is a local-y one.
    expect(seen).toHaveLength(1);
    seen[0].forEach((v, i) => expect(v).toBeCloseTo([1, 0, 0, -1, 0, 50][i], 9));
  });
});
