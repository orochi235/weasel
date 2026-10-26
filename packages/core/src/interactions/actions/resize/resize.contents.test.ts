/**
 * Resizing a container whose pose is a frame changes its box, not where its
 * contents draw: a handle that moves the frame's origin leaves its children
 * where they were, in the preview and in the commit.
 */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { unionOfChildren } from 'core/scene/kitRegistry';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import { scenePoseFrame } from '../poseFrame';
import { resizeAction } from './action';

const BOX = asNodeId('box');
const KID = asNodeId('kid');
const INNER = asNodeId('inner');

/** A container at (100, 100) holding a leaf at (150, 150) in world, and an
 *  envelope whose member sits at (200, 120). */
function makeScene(): Scene<unknown, string, unknown> {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: BOX, kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 200, height: 100 } });
  scene.add({ id: KID, kind: 'mark', layer: 'main', parent: BOX, data: {}, pose: { x: 50, y: 50, width: 20, height: 20 } });
  scene.add({
    id: asNodeId('env'), kind: 'group', layer: 'main', parent: BOX, data: {}, pose: { x: 0, y: 0, width: 0, height: 0 },
    dependsOn: 'children', derivePose: unionOfChildren,
  });
  scene.add({ id: INNER, kind: 'mark', layer: 'main', parent: asNodeId('env'), data: {}, pose: { x: 100, y: 20, width: 10, height: 10 } });
  return scene as unknown as Scene<unknown, string, unknown>;
}

/** The top-left handle dragged from the container's corner to `to`. */
function ctxAt(scene: Scene<unknown, string, unknown>, to: { x: number; y: number }): InvocationCtx {
  return {
    world: to,
    screen: to,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => [BOX] as NodeId[] }, scene },
    drag: {
      start: { x: 100, y: 100 }, current: to, delta: { x: to.x - 100, y: to.y - 100 },
      affordance: { kind: 'handle:top-left', targetIds: [BOX as string], anchor: { x: 'max', y: 'max' } },
    },
  } as unknown as InvocationCtx;
}

const worldAt = (scene: Scene<unknown, string, unknown>, id: NodeId) => {
  const p = scenePoseFrame(scene).world(id) as RectPose;
  return { x: p.x, y: p.y };
};

describe('resizing a frame', () => {
  it('leaves its contents where they drew, while it previews and once it commits, in one undo step', () => {
    const scene = makeScene();
    const entries = scene.historyEntries().length;
    const handle = resizeAction.invoker!.timing === 'ongoing'
      ? resizeAction.invoker!.start(ctxAt(scene, { x: 100, y: 100 }), undefined) as OngoingHandle
      : null;
    handle!.onMove!(ctxAt(scene, { x: 40, y: 60 }));
    expect(worldAt(scene, KID)).toEqual({ x: 150, y: 150 });
    expect(worldAt(scene, INNER)).toEqual({ x: 200, y: 120 });
    handle!.onEnd!(ctxAt(scene, { x: 40, y: 60 }), 'commit');
    expect(scene.get(BOX)!.pose).toMatchObject({ x: 40, y: 60, width: 260, height: 140 });
    expect(worldAt(scene, KID)).toEqual({ x: 150, y: 150 });
    expect(worldAt(scene, INNER)).toEqual({ x: 200, y: 120 });
    expect(scene.historyEntries()).toHaveLength(entries + 1);
    scene.undo();
    expect(scene.get(KID)!.pose).toMatchObject({ x: 50, y: 50 });
  });
});
