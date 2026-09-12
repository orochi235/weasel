/**
 * Rotate against a scene whose container pose is a frame. See
 * `alignDistribute.frame.test.ts` for why the fixture is needed at all.
 */
import { describe, it, expect } from 'vitest';
import { rotateAction } from './rotate';
import { RIGID_POSE_COMPOSITION } from 'features/groups/composePose';
import {
  makeFrameFixture,
  expectSamePose,
  FRAME_FIXTURE_IDS,
  FRAME_FIXTURE_LOCAL,
} from 'features/groups/frameFixture';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { InvocationCtx } from '../invoker';

const { upright, turned } = FRAME_FIXTURE_IDS;
const IDS: NodeId[] = [upright, turned];

function makeScene() {
  return makeFrameFixture() as unknown as Scene<unknown, string, unknown>;
}

function ctxAt(scene: Scene<unknown, string, unknown>, x: number, y: number): InvocationCtx {
  return {
    world: { x, y },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => IDS },
      scene,
      poseComposition: RIGID_POSE_COMPOSITION,
    },
  } as unknown as InvocationCtx;
}

/** Drag from due east of `(px, py)` to `(px, py) + to`, so the angle the
 *  action derives is exactly the turn named in each test. */
function drag(
  scene: Scene<unknown, string, unknown>,
  pivot: { x: number; y: number },
  to: { x: number; y: number },
) {
  const invoker = rotateAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(ctxAt(scene, pivot.x + 100, pivot.y), undefined);
  handle.onMove!(ctxAt(scene, to.x, to.y));
  handle.onEnd!(ctxAt(scene, to.x, to.y), 'commit');
}

function poseOf(scene: Scene<unknown, string, unknown>, id: NodeId): RectPose {
  return scene.get(id)!.pose as RectPose;
}

describe('rotateAction under a container frame', () => {
  it('orbits about the world union center and stores the result in the group frame', () => {
    const scene = makeScene();
    // World AABBs are (70,10,10,20) and (10,50,40,20), so the union spans
    // x 10..80 by y 10..70 and the pivot is (45,40) — not the (40,55) the
    // stored poses would give.
    drag(scene, { x: 45, y: 40 }, { x: 45, y: 140 });
    expectSamePose(poseOf(scene, upright), { x: 60, y: 30, width: 20, height: 10, rotation: Math.PI / 2 });
    expectSamePose(poseOf(scene, turned), { x: 5, y: 65, width: 40, height: 20, rotation: Math.PI });
  });

  it('does not drift when a quarter turn is undone by the opposite one', () => {
    const scene = makeScene();
    drag(scene, { x: 45, y: 40 }, { x: 45, y: 140 });
    // A quarter turn maps axis-aligned boxes to axis-aligned boxes, so the
    // union center is still (45,40) and the reverse drag is exact.
    drag(scene, { x: 45, y: 40 }, { x: 45, y: -60 });
    expectSamePose(poseOf(scene, upright), FRAME_FIXTURE_LOCAL.a);
    expectSamePose(poseOf(scene, turned), FRAME_FIXTURE_LOCAL.b);
  });

  it('publishes previews in the frame the scene reads them back in', () => {
    const scene = makeScene();
    const invoker = rotateAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(ctxAt(scene, 145, 40), undefined);
    handle.onMove!(ctxAt(scene, 45, 140));
    // An override stands in for the stored pose, so it has to be local.
    expect(scene.overrides.get(upright)?.pose).toEqual(handle.previewPose!(upright));
    expectSamePose(
      handle.previewPose!(upright) as RectPose,
      { x: 60, y: 30, width: 20, height: 10, rotation: Math.PI / 2 },
    );
    handle.onEnd!(ctxAt(scene, 45, 140), 'cancel');
  });
});
