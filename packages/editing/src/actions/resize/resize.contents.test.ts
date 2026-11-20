/**
 * Resizing a container whose pose is a frame changes its box, not where its
 * contents draw: a handle that moves the frame's origin leaves its children
 * where they were, in the preview and in the commit.
 */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { createScene, unionOfChildren, scenePoseFrame, defaultCommitAdapter } from '@weasel-js/core/engine';
import { asNodeId, type NodeId, type RectPose, type Scene } from '@weasel-js/core';
import { resizeAction } from './action';
import { resizeSelectionOps } from './replay';

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
    deps: { operands: { get: () => [BOX] as NodeId[] }, scene },
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

  it('leaves its contents where they drew when the resize is replayed by command', () => {
    const scene = makeScene();
    // The drag above, from 200 × 100 to 260 × 140 holding the bottom-right corner.
    const units = { x: -0.3, y: -0.4, width: 1.3, height: 1.4 };
    const ops = resizeSelectionOps(scene, [BOX], { x: 'max', y: 'max' }, units, {}, 'Scale');
    scene.applyBatch(ops, 'Scale', defaultCommitAdapter(scene));
    expect(scene.get(BOX)!.pose).toMatchObject({ x: 40, y: 60, width: 260, height: 140 });
    expect(worldAt(scene, KID)).toEqual({ x: 150, y: 150 });
    expect(worldAt(scene, INNER)).toEqual({ x: 200, y: 120 });
  });
});
