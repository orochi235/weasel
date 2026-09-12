/**
 * Resize against a scene whose container pose is a frame. See
 * `alignDistribute.frame.test.ts` for why the fixture is needed at all.
 */
import { describe, it, expect } from 'vitest';
import { resizeAction } from './resize';
import { RIGID_POSE_COMPOSITION } from 'features/groups/composePose';
import {
  makeFrameFixture,
  expectSamePose,
  FRAME_FIXTURE_IDS,
  FRAME_FIXTURE_LOCAL,
} from 'features/groups/frameFixture';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { InvocationCtx } from '../invoker';

const { upright } = FRAME_FIXTURE_IDS;

function makeScene() {
  return makeFrameFixture() as unknown as Scene<unknown, string, unknown>;
}

/** Drag the bottom-right handle — the corner opposite a fixed min/min anchor. */
function ctxAt(
  scene: Scene<unknown, string, unknown>,
  at: { x: number; y: number },
): InvocationCtx {
  return {
    world: at,
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => [upright] as NodeId[] },
      scene,
      poseComposition: RIGID_POSE_COMPOSITION,
    },
    drag: {
      start: { x: 0, y: 0 },
      current: at,
      delta: at,
      affordance: {
        kind: 'handle:bottom-right',
        targetIds: [upright as string],
        anchor: { x: 'min', y: 'min' },
      },
    },
  } as unknown as InvocationCtx;
}

function drag(scene: Scene<unknown, string, unknown>, to: { x: number; y: number }) {
  const invoker = resizeAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(ctxAt(scene, { x: 0, y: 0 }), undefined);
  handle.onMove!(ctxAt(scene, to));
  handle.onEnd!(ctxAt(scene, to), 'commit');
}

function poseOf(scene: Scene<unknown, string, unknown>, id: NodeId): RectPose {
  return scene.get(id)!.pose as RectPose;
}

describe('resizeAction under a container frame', () => {
  it('projects the drag through the ancestor turn, not just the node own one', () => {
    const scene = makeScene();
    // The child is upright in the group's frame but stands a quarter turn in
    // world, so a world drag straight down grows it along its own x axis.
    drag(scene, { x: 0, y: 20 });
    expectSamePose(poseOf(scene, upright), { x: 10, y: 20, width: 40, height: 10, rotation: 0 });
  });

  it('pins the world corner the anchor names', () => {
    const scene = makeScene();
    drag(scene, { x: 0, y: 20 });
    // World pose (55,25,40,10) turned a quarter about its center (75,30) puts
    // the anchored corner back at (80,10), where it started.
    const world = { x: 55, y: 25, width: 40, height: 10, rotation: Math.PI / 2 };
    const node = scene.get(upright)!;
    expect(node.parent).toBe(FRAME_FIXTURE_IDS.group);
    expectSamePose(
      RIGID_POSE_COMPOSITION.compose(
        scene.get(FRAME_FIXTURE_IDS.group)!.pose as RectPose,
        poseOf(scene, upright),
      ),
      world,
    );
  });

  it('does not drift when a drag is undone by the opposite one', () => {
    const scene = makeScene();
    drag(scene, { x: 0, y: 20 });
    drag(scene, { x: 0, y: -20 });
    expectSamePose(poseOf(scene, upright), FRAME_FIXTURE_LOCAL.a);
  });
});
