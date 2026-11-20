import { describe, expect, it } from 'vitest';
import { createScene, IDENTITY_POSE_COMPOSITION, RIGID_POSE_COMPOSITION, scenePoseFrame } from '@weasel-js/core/engine';
import { expectSamePoseForTests as expectSamePose } from '@weasel-js/core/test-seams';
import { defaultCommitAdapter, type NodeId, type RectPose } from '@weasel-js/core';
import { swapOps } from './swapOps';

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

function sceneWith(composed: boolean) {
  return createScene<object, 'main' | 'top', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'top' }],
    composition: composed ? RIGID_POSE_COMPOSITION : IDENTITY_POSE_COMPOSITION,
  });
}
type S = ReturnType<typeof sceneWith>;

const worldOf = (scene: S, id: string): RectPose => scenePoseFrame(scene as never).world(id as NodeId) as RectPose;
const swap = (scene: S, a: string, b: string): void => {
  const ops = swapOps(scene as never, a, b);
  expect(ops).not.toBeNull();
  scene.applyBatch(ops!, 'Swap', defaultCommitAdapter(scene as never));
};

describe('swapOps', () => {
  it('trades two siblings’ places and stacking order', () => {
    const scene = sceneWith(false);
    const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
    const m = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(20, 0) });
    const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(50, 0) });
    swap(scene, a, b);
    expect(scene.get(a)!.pose).toEqual(box(50, 0));
    expect(scene.get(b)!.pose).toEqual(box(0, 0));
    expect(scene.roots).toEqual([b, m, a]);
  });

  it('moves each into the other’s parent and slot under composed frames, children riding along', () => {
    const scene = sceneWith(true);
    const g1 = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(100, 100, 100, 100) });
    const g2 = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(300, 0, 100, 100) });
    const a = scene.add({ kind: 'group', layer: 'main', parent: g1, data: {}, pose: box(10, 10, 20, 20) });
    const inA = scene.add({ kind: 'mark', layer: 'main', parent: a, data: {}, pose: box(2, 2, 4, 4) });
    const x = scene.add({ kind: 'mark', layer: 'main', parent: g2, data: {}, pose: box(0, 0) });
    const b = scene.add({ kind: 'group', layer: 'main', parent: g2, data: {}, pose: box(40, 50, 20, 20) });
    const y = scene.add({ kind: 'mark', layer: 'main', parent: g2, data: {}, pose: box(0, 0) });
    const aWorld = worldOf(scene, a);
    const bWorld = worldOf(scene, b);
    const inWorld = worldOf(scene, inA);
    swap(scene, a, b);
    expect(scene.get(a)!.parent).toBe(g2);
    expect(scene.get(b)!.parent).toBe(g1);
    expect(scene.childrenOf(g2)).toEqual([x, a, y]);
    expectSamePose(worldOf(scene, a), bWorld);
    expectSamePose(worldOf(scene, b), aWorld);
    expectSamePose(worldOf(scene, inA), { ...inWorld, x: inWorld.x + bWorld.x - aWorld.x, y: inWorld.y + bWorld.y - aWorld.y });
    scene.undo();
    expect(scene.get(a)!.parent).toBe(g1);
    expect(scene.childrenOf(g2)).toEqual([x, b, y]);
    expectSamePose(worldOf(scene, a), aWorld);
  });

  it('trades layers along with places', () => {
    const scene = sceneWith(false);
    const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
    const b = scene.add({ kind: 'mark', layer: 'top', data: {}, pose: box(50, 0) });
    swap(scene, a, b);
    expect(scene.get(a)!.layer).toBe('top');
    expect(scene.get(b)!.layer).toBe('main');
  });
});
