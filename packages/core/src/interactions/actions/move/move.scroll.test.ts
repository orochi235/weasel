/**
 * Moves inside a container whose content the view scrolls. The gesture reads
 * the world the view shows and writes back through the same fold, so what it
 * stores is the content position: the document never moves with the scroll.
 */
import { describe, expect, it } from 'vitest';
import { moveAction } from './action';
import type { InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { expectSamePose } from 'core/scene/frameFixture';
import { scenePoseFrame } from '../poseFrame';
import { sceneGestureFrames } from '../gestureFrames';
import type { NodeId, RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

const box = (x: number, y: number, w = 10, h = 10, rotation?: number): RectPose =>
  rotation === undefined ? { x, y, width: w, height: h } : { x, y, width: w, height: h, rotation };

function ctx(scene: S, ids: string[], drag?: { start: { x: number; y: number }; current: { x: number; y: number }; delta: { x: number; y: number } }): InvocationCtx {
  return {
    world: drag ? drag.current : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => ids } as unknown as SelectionApi, scene },
    drag,
  } as unknown as InvocationCtx;
}

function scrolled(rotation?: number) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: RIGID_POSE_COMPOSITION });
  const c = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(100, 100, 100, 100, rotation) });
  const s = scene.add({ kind: 'mark', parent: c, layer: 'main', data: {}, pose: box(10, 160) });
  scene.scroll.set(c, { x: 0, y: 150 });
  return { scene, c, s };
}

const worldOf = (scene: S, id: string): RectPose => scenePoseFrame(scene as never).world(id as NodeId) as RectPose;

describe('moveAction inside a scrolled container', () => {
  it('stores the content position, and the child is shown where the pointer took it', () => {
    const { scene, s } = scrolled();
    // Stored 160 down, scrolled 150: shown 10 down the container.
    expectSamePose(worldOf(scene, s), box(110, 110, 10, 10, 0));
    const drag = { start: { x: 115, y: 115 }, current: { x: 145, y: 135 }, delta: { x: 30, y: 20 } };
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [s]), {}) as OngoingHandle;
    handle.onMove!(ctx(scene, [s], drag));
    expectSamePose(worldOf(scene, s), box(140, 130, 10, 10, 0));
    handle.onEnd!(ctx(scene, [s], drag), 'commit');
    expectSamePose(worldOf(scene, s), box(140, 130, 10, 10, 0));
    expectSamePose(scene.get(s)!.pose, box(40, 180, 10, 10, 0));
  });

  it('keeps where a child is shown when it is moved out of the scrolled container', () => {
    const { scene, c, s } = scrolled();
    const target = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(400, 0, 200, 200) });
    const frames = sceneGestureFrames(scene as never, {} as never);
    const shown = frames.world(s);
    const stored = frames.toLocalUnder(target, shown) as RectPose;
    scene.update(s, { parent: target, pose: stored });
    expectSamePose(worldOf(scene, s), shown as RectPose);
    expect(scene.get(c)!.pose).toEqual(box(100, 100, 100, 100));
  });

  it('reads and writes the same fold under a turned container', () => {
    const { scene, s } = scrolled(Math.PI / 2);
    const frames = sceneGestureFrames(scene as never, {} as never);
    const shown = frames.world(s);
    expectSamePose(frames.toLocal(s, shown) as RectPose, box(10, 160, 10, 10, 0));
    expectSamePose(frames.toWorld(s, scene.get(s)!.pose) as RectPose, shown as RectPose);
  });
});
