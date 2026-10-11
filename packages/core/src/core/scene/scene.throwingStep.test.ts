import { describe, it, expect } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';

const POSE = { x: 0, y: 0, width: 10, height: 10 };
const A = asNodeId('a');
const B = asNodeId('b');

function makeScene() {
  const scene = createScene<{ label: string }, 'default'>({ systemLayers: [{ id: 'default' }] });
  const add = (id: string) =>
    scene.add({ id: asNodeId(id), kind: 'leaf', layer: 'default', pose: { ...POSE }, data: { label: id } });
  const adapter = { setPose: (id: string, pose: unknown) => { scene.setPose(asNodeId(id), pose as typeof POSE); } };
  const depths = () => [scene.history.undoDepth(), scene.history.redoDepth()];
  return { scene, add, adapter, depths };
}

describe('Scene — a history step that throws', () => {
  it('undo of an edit to a node removed untracked keeps the entry and the state', () => {
    const { scene, add, depths } = makeScene();
    add('a');
    scene.setPose(A, { ...POSE, x: 5 });
    scene.untracked(() => scene.remove(A));
    const before = scene.toJSON();

    expect(() => scene.undo()).toThrow('unknown node id "a"');
    expect(depths()).toEqual([2, 0]);
    expect(scene.toJSON()).toEqual(before);
  });

  it('undo reverts the ops of the entry that ran before the one that threw', () => {
    const { scene, add, depths } = makeScene();
    add('a');
    add('b');
    scene.batch('move both', () => {
      scene.setPose(A, { ...POSE, x: 5 });
      scene.setPose(B, { ...POSE, x: 7 });
    });
    scene.untracked(() => scene.remove(A));

    // Undo reverts b's pose, then a's, which is gone.
    expect(() => scene.undo()).toThrow('unknown node id "a"');
    expect(scene.get(B)!.pose.x).toBe(7);
    expect(depths()).toEqual([3, 0]);
  });

  it('undo of an applyBatch entry reverts the scene writes of its ops that ran', () => {
    const { scene, add, adapter, depths } = makeScene();
    add('a');
    add('b');
    scene.applyBatch([
      createTransformOp({ id: A, from: { ...POSE }, to: { ...POSE, x: 5 } }),
      createTransformOp({ id: B, from: { ...POSE }, to: { ...POSE, x: 7 } }),
    ], 'move both', adapter);
    scene.untracked(() => scene.remove(A));
    const versionBefore = scene.getVersion();

    expect(() => scene.undo()).toThrow('unknown node id "a"');
    expect(scene.get(B)!.pose.x).toBe(7);
    expect(depths()).toEqual([3, 0]);
    expect(scene.getVersion()).toBeGreaterThan(versionBefore);
  });

  it('undo reverts the scene writes of an op that threw partway through its own', () => {
    const { scene, add, depths } = makeScene();
    add('a');
    add('b');
    const moveBoth = (to: number, from: number): Op => ({
      apply: () => {
        scene.setPose(B, { ...POSE, x: to });
        scene.setPose(A, { ...POSE, x: to });
      },
      invert: () => moveBoth(from, to),
    });
    scene.setSelection([B]);
    scene.applyBatch([moveBoth(9, 0)], 'move both', undefined);
    scene.setSelection([]);
    scene.untracked(() => scene.remove(A));

    expect(() => scene.undo()).toThrow('unknown node id "a"');
    expect(scene.get(B)!.pose.x).toBe(9);
    expect(scene.getSelection()).toEqual([]);
    expect(depths()).toEqual([3, 0]);
  });

  it('redo keeps the entry and the state when it throws', () => {
    const { scene, add, depths } = makeScene();
    add('a');
    add('b');
    scene.batch('move both', () => {
      scene.setPose(B, { ...POSE, x: 7 });
      scene.setPose(A, { ...POSE, x: 5 });
    });
    scene.undo();
    scene.untracked(() => scene.remove(A));

    expect(() => scene.redo()).toThrow('unknown node id "a"');
    expect(scene.get(B)!.pose.x).toBe(0);
    expect(depths()).toEqual([2, 1]);
  });

  it('a jump through history that throws partway returns to where it started', () => {
    const { scene, add, depths } = makeScene();
    add('b');
    add('a');
    scene.setPose(A, { ...POSE, x: 5 });
    scene.setPose(B, { ...POSE, x: 7 });
    scene.untracked(() => scene.remove(A));

    expect(() => scene.jumpToHistoryIndex(0)).toThrow('unknown node id "a"');
    expect(scene.get(B)!.pose.x).toBe(7);
    expect(depths()).toEqual([4, 0]);
  });
});
