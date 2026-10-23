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
    scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: { ...POSE }, data: { label: id } });
  const adapter = { setPose: (id: string, pose: unknown) => { scene.setPose(asNodeId(id), pose as typeof POSE); } };
  const depths = () => [scene.history.undoDepth(), scene.history.redoDepth()];
  // What throws: a kit op and an external op that each refuse once armed.
  const armed = { on: false };
  const refuse = (): void => { if (armed.on) throw new Error('refused'); };
  scene.registerOp('refusing', { apply: refuse, revert: refuse });
  const refusing = (): Op => ({ apply: refuse, invert: refusing });
  return { scene, add, adapter, depths, armed, refusing };
}

describe('Scene — a history step that throws', () => {
  it('undo keeps the entry and the state', () => {
    const { scene, add, depths, armed } = makeScene();
    add('a');
    scene.batch('move', () => {
      scene.setPose(A, { ...POSE, x: 5 });
      scene.recordOp({ kind: 'refusing', payload: null });
    });
    armed.on = true;
    const before = scene.toJSON();

    expect(() => scene.undo()).toThrow('refused');
    expect(depths()).toEqual([2, 0]);
    expect(scene.toJSON()).toEqual(before);
  });

  it('undo reverts the ops of the entry that ran before the one that threw', () => {
    const { scene, add, depths, armed } = makeScene();
    add('b');
    scene.batch('move', () => {
      scene.recordOp({ kind: 'refusing', payload: null });
      scene.setPose(B, { ...POSE, x: 7 });
    });
    armed.on = true;

    // Undo reverts b's pose, then the op that refuses.
    expect(() => scene.undo()).toThrow('refused');
    expect(scene.get(B)!.pose.x).toBe(7);
    expect(depths()).toEqual([2, 0]);
  });

  it('undo of an applyBatch entry reverts the scene writes of its ops that ran', () => {
    const { scene, add, adapter, depths, armed, refusing } = makeScene();
    add('b');
    scene.applyBatch([
      refusing(),
      createTransformOp({ id: B, from: { ...POSE }, to: { ...POSE, x: 7 } }),
    ], 'move', adapter);
    armed.on = true;
    const versionBefore = scene.getVersion();

    expect(() => scene.undo()).toThrow('refused');
    expect(scene.get(B)!.pose.x).toBe(7);
    expect(depths()).toEqual([2, 0]);
    expect(scene.getVersion()).toBeGreaterThan(versionBefore);
  });

  it('undo of an applyBatch entry restores what its op wrote without running the op', () => {
    const { scene, add, depths, armed } = makeScene();
    add('b');
    const move = (to: number, from: number): Op => ({
      apply: () => {
        scene.setPose(B, { ...POSE, x: to });
        if (armed.on) throw new Error('refused');
      },
      invert: () => move(from, to),
    });
    scene.setSelection([B]);
    scene.applyBatch([move(9, 0)], 'move', undefined);
    scene.setSelection([]);
    armed.on = true;

    expect(scene.undo()).toBe(true);
    expect(scene.get(B)!.pose.x).toBe(0);
    expect(scene.getSelection()).toEqual([B]);
    expect(depths()).toEqual([1, 1]);
  });

  it('redo keeps the entry and the state when it throws', () => {
    const { scene, add, depths, armed } = makeScene();
    add('b');
    scene.batch('move', () => {
      scene.setPose(B, { ...POSE, x: 7 });
      scene.recordOp({ kind: 'refusing', payload: null });
    });
    scene.undo();
    armed.on = true;

    expect(() => scene.redo()).toThrow('refused');
    expect(scene.get(B)!.pose.x).toBe(0);
    expect(depths()).toEqual([1, 1]);
  });

  it('a jump through history that throws partway returns to where it started', () => {
    const { scene, add, depths, armed } = makeScene();
    add('b');
    scene.recordOp({ kind: 'refusing', payload: null });
    scene.setPose(B, { ...POSE, x: 7 });
    armed.on = true;

    expect(() => scene.jumpToHistoryIndex(0)).toThrow('refused');
    expect(scene.get(B)!.pose.x).toBe(7);
    expect(depths()).toEqual([3, 0]);
  });
});
