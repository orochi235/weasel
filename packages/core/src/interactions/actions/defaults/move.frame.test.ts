/**
 * Translate-only moves against a scene whose container pose is a frame. See
 * `alignDistribute.frame.test.ts` for why the fixture has to differ from the
 * identity default: there, local and world are one value and every assertion
 * here passes whether or not the action composes.
 *
 * Each case is checked twice, mid-drag through the published overrides and
 * after the commit, against world poses derived by hand.
 */
import { describe, expect, it } from 'vitest';
import { moveAction } from './move';
import type { InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { unionOfChildren } from 'core/scene/kitRegistry';
import { RIGID_POSE_COMPOSITION } from 'features/groups/composePose';
import { expectSamePose } from 'features/groups/frameFixture';
import { scenePoseFrame } from '../poseFrame';
import type { NodeId, RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

const box = (x: number, y: number, w = 10, h = 10, rotation?: number): RectPose =>
  rotation === undefined ? { x, y, width: w, height: h } : { x, y, width: w, height: h, rotation };

const DRAG = { start: { x: 50, y: 50 }, current: { x: 150, y: 50 }, delta: { x: 100, y: 0 } };

function ctx(scene: S, ids: string[], drag?: typeof DRAG): InvocationCtx {
  return {
    world: drag ? drag.current : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => ids } as unknown as SelectionApi,
      scene,
      poseComposition: RIGID_POSE_COMPOSITION,
    },
    drag,
  } as unknown as InvocationCtx;
}

const worldOf = (scene: S, id: string): RectPose =>
  scenePoseFrame(scene as never, RIGID_POSE_COMPOSITION).world(id as NodeId) as RectPose;

/** Drag `ids` by `DRAG`, checking `expected` world poses mid-drag and after. */
function dragAndCheck(scene: S, ids: string[], expected: Record<string, RectPose>): void {
  const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, ids), {}) as OngoingHandle;
  handle.onMove!(ctx(scene, ids, DRAG));
  for (const [id, pose] of Object.entries(expected)) expectSamePose(worldOf(scene, id), pose);
  handle.onEnd!(ctx(scene, ids, DRAG), 'commit');
  for (const [id, pose] of Object.entries(expected)) expectSamePose(worldOf(scene, id), pose);
}

function sceneWith(): S {
  return createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
}

describe('moveAction under a container frame', () => {
  it('moves a frame container once, carrying its children with it', () => {
    const scene = sceneWith();
    const c = scene.add({ kind: 'container', layer: 'main', data: {}, pose: box(0, 0, 200, 200) });
    const s = scene.add({ kind: 'leaf', parent: c, layer: 'main', data: {}, pose: box(10, 10) });
    dragAndCheck(scene, [c], { [c]: box(100, 0, 200, 200, 0), [s]: box(110, 10, 10, 10, 0) });
    // Carried, not moved: its pose in the frame is untouched.
    expect(scene.get(s)!.pose).toEqual(box(10, 10));
  });

  it('moves a leaf inside a turned frame the way the pointer went', () => {
    const scene = sceneWith();
    const c = scene.add({
      kind: 'container', layer: 'main', data: {}, pose: box(0, 0, 200, 200, Math.PI / 2),
    });
    const s = scene.add({ kind: 'leaf', parent: c, layer: 'main', data: {}, pose: box(10, 10) });
    // Local center (15,15) is (-85,-85) from the frame's center (100,100); a
    // quarter turn sends that to (85,-85), so the leaf starts centered at
    // (185,15) and a drag 100 right lands it at (285,15).
    expectSamePose(worldOf(scene, s), box(180, 10, 10, 10, Math.PI / 2));
    dragAndCheck(scene, [s], { [s]: box(280, 10, 10, 10, Math.PI / 2) });
  });

  it('moves the children of an envelope, which carries nothing', () => {
    const scene = sceneWith();
    const e = scene.add({
      kind: 'container', layer: 'main', data: {}, pose: box(0, 0, 1, 1),
      dependsOn: 'children', derivePose: unionOfChildren,
    });
    const s = scene.add({ kind: 'leaf', parent: e, layer: 'main', data: {}, pose: box(10, 10) });
    dragAndCheck(scene, [e], { [e]: box(110, 10), [s]: box(110, 10) });
  });
});
