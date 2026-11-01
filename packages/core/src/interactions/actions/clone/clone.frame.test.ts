/**
 * Clone against a scene whose container pose is a frame. See
 * `alignDistribute.frame.test.ts` for why the fixture is needed at all.
 */
import { describe, it, expect } from 'vitest';
import { cloneAction } from './action';
import {
  makeFrameFixture,
  expectSamePose,
  FRAME_FIXTURE_IDS,
  FRAME_FIXTURE_LOCAL,
} from 'core/scene/frameFixture';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { InvocationCtx } from '@weasel-js/routing';
import { sceneToAdapter } from 'canvas/sceneAdapter';

const { group, upright, turned } = FRAME_FIXTURE_IDS;

function makeScene() {
  return makeFrameFixture();
}

function ctxAt(
  scene: Scene<unknown, string, unknown>,
  dx: number,
  dy: number,
  selected: NodeId[] = [upright],
): InvocationCtx {
  return {
    world: { x: dx, y: dy },
    screen: { x: 0, y: 0 },
    modifiers: { alt: true, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => selected, set: () => {} },
      scene,
    },
    drag: { start: { x: 0, y: 0 }, current: { x: dx, y: dy }, delta: { x: dx, y: dy } },
  } as unknown as InvocationCtx;
}

/** The clone's pose. It is the only child of the group that is not a fixture
 *  node, and the drag is what put it there. */
function clonedPose(scene: Scene<unknown, string, unknown>): RectPose {
  const fresh = scene.childrenOf(group).filter((id) => id !== upright && id !== turned);
  expect(fresh).toHaveLength(1);
  return scene.get(fresh[0])!.pose as RectPose;
}

describe('cloneAction under a container frame', () => {
  it('carries the copy the world distance the pointer moved', () => {
    const scene = makeScene();
    const invoker = cloneAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(ctxAt(scene, 0, 0), undefined);
    handle.onMove!(ctxAt(scene, 0, 20));
    handle.onEnd!(ctxAt(scene, 0, 20), 'commit');
    // A world drag straight down is a move along the group's local x axis.
    expectSamePose(clonedPose(scene), { x: 30, y: 20, width: 20, height: 10, rotation: 0 });
  });

  it('previews the copy in the frame the ghost is painted from', () => {
    const scene = makeScene();
    const invoker = cloneAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(ctxAt(scene, 0, 0), undefined);
    handle.onMove!(ctxAt(scene, 0, 20));
    expectSamePose(
      handle.previewPose!(upright) as RectPose,
      { x: 30, y: 20, width: 20, height: 10, rotation: 0 },
    );
    handle.onEnd!(ctxAt(scene, 0, 20), 'cancel');
  });

  it('previews the copy where the committed copy is drawn', () => {
    const scene = makeScene();
    const adapter = sceneToAdapter(scene, {});
    const invoker = cloneAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(ctxAt(scene, 0, 0), undefined);
    handle.onMove!(ctxAt(scene, 0, 20));
    const previewed = adapter.worldOfStored(upright, handle.previewPose!(upright) as RectPose);
    handle.onEnd!(ctxAt(scene, 0, 20), 'commit');
    const copy = scene.childrenOf(group).find((id) => id !== upright && id !== turned)!;
    expectSamePose(previewed, adapter.getWorldPose(copy));
  });

  it('leaves a copied group\'s children at their own poses in its frame', () => {
    const scene = makeScene();
    const invoker = cloneAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(ctxAt(scene, 0, 0, [group]), undefined);
    handle.onMove!(ctxAt(scene, 0, 20, [group]));
    handle.onEnd!(ctxAt(scene, 0, 20, [group]), 'commit');

    const copy = scene.roots.filter((id) => id !== group);
    expect(copy).toHaveLength(1);
    expectSamePose(scene.get(copy[0])!.pose as RectPose, { x: 0, y: 20, width: 100, height: 100, rotation: Math.PI / 2 });
    const kids = scene.childrenOf(copy[0]).map((id) => scene.get(id)!.pose as RectPose);
    expect(kids).toHaveLength(2);
    expectSamePose(kids[0], FRAME_FIXTURE_LOCAL.a);
    expectSamePose(kids[1], FRAME_FIXTURE_LOCAL.b);
  });
});
