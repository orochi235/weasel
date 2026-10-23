import { describe, it, expect } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';

const POSE = { x: 0, y: 0, width: 10, height: 10 };
const A = asNodeId('a');
const B = asNodeId('b');
const G = asNodeId('g');

function makeScene() {
  const scene = createScene<{ label: string }, 'default'>({ systemLayers: [{ id: 'default' }] });
  const spec = (id: string, kind: 'mark' | 'group' = 'mark') =>
    ({ id: asNodeId(id), kind, layer: 'default' as const, pose: { ...POSE }, data: { label: id } });
  const add = (id: string, kind: 'mark' | 'group' = 'mark') => scene.add(spec(id, kind));
  const adapter = { setPose: (id: string, pose: unknown) => { scene.setPose(asNodeId(id), pose as typeof POSE); } };
  const depths = () => [scene.history.undoDepth(), scene.history.redoDepth()];
  return { scene, spec, add, adapter, depths };
}

describe('Scene — replaying an entry whose node an untracked edit took', () => {
  it('undo walks past the entries that name the node and reaches the ones beneath', () => {
    const { scene, add, depths } = makeScene();
    add('b');
    scene.setPose(B, { ...POSE, x: 7 });
    add('a');
    scene.setPose(A, { ...POSE, x: 5 });
    scene.untracked(() => scene.remove(A));

    expect(scene.undo()).toBe(true);
    expect(scene.undo()).toBe(true);
    expect(depths()).toEqual([2, 2]);
    expect(scene.get(A)).toBeUndefined();
    expect(scene.undo()).toBe(true);
    expect(scene.get(B)!.pose.x).toBe(0);
  });

  it('applies the rest of an entry that also names a live node', () => {
    const { scene, add } = makeScene();
    add('a');
    add('b');
    scene.batch('move both', () => {
      scene.setPose(A, { ...POSE, x: 5 });
      scene.setPose(B, { ...POSE, x: 7 });
    });
    scene.untracked(() => scene.remove(A));

    scene.undo();
    expect(scene.get(B)!.pose.x).toBe(0);
    scene.redo();
    expect(scene.get(B)!.pose.x).toBe(7);
    expect(scene.get(A)).toBeUndefined();
  });

  it('skips the op of a gesture entry that names the node', () => {
    const { scene, add, adapter, depths } = makeScene();
    add('a');
    add('b');
    scene.applyBatch([
      createTransformOp({ id: A, from: { ...POSE }, to: { ...POSE, x: 5 } }),
      createTransformOp({ id: B, from: { ...POSE }, to: { ...POSE, x: 7 } }),
    ], 'move both', adapter);
    scene.untracked(() => scene.remove(A));

    scene.undo();
    expect(scene.get(B)!.pose.x).toBe(0);
    expect(depths()).toEqual([2, 1]);
  });

  it('a first apply still throws on a node the scene does not hold', () => {
    const { scene, add, adapter } = makeScene();
    add('b');
    expect(() => scene.applyBatch(
      [createTransformOp({ id: A, from: { ...POSE }, to: { ...POSE, x: 5 } })], 'move', adapter,
    )).toThrow('unknown node id "a"');
    expect(scene.canUndo()).toBe(true);
    expect(scene.history.undoDepth()).toBe(1);
  });

  it('undoing a removal leaves a node an untracked edit added back under that id', () => {
    const { scene, spec, add } = makeScene();
    add('a');
    scene.remove(A);
    scene.untracked(() => scene.add({ ...spec('a'), data: { label: 'again' } }));

    scene.undo();
    expect(scene.get(A)!.data.label).toBe('again');
    expect(scene.roots).toEqual([A]);
    scene.redo();
    expect(scene.get(A)!.data.label).toBe('again');
  });

  it('does the same for a removal an external op made', () => {
    const { scene, spec, add } = makeScene();
    add('a');
    const insert = (): Op => ({ apply: () => { scene.add(spec('a')); }, invert: remove });
    const remove = (): Op => ({ apply: () => { scene.remove(A); }, invert: insert });
    scene.applyBatch([remove()], 'delete', undefined);
    scene.untracked(() => scene.add({ ...spec('a'), data: { label: 'again' } }));

    scene.undo();
    expect(scene.get(A)!.data.label).toBe('again');
    scene.redo();
    expect(scene.get(A)!.data.label).toBe('again');
  });

  it('redoing an add leaves a node an untracked edit added under that id', () => {
    const { scene, spec, add } = makeScene();
    add('a');
    scene.undo();
    scene.untracked(() => scene.add({ ...spec('a'), data: { label: 'again' } }));

    scene.redo();
    expect(scene.get(A)!.data.label).toBe('again');
    expect(scene.roots).toEqual([A]);
  });

  it('skips a move into a container that is gone', () => {
    const { scene, add } = makeScene();
    add('g', 'group');
    add('a');
    scene.move(A, G);
    scene.undo();
    scene.untracked(() => scene.remove(G));

    scene.redo();
    expect(scene.get(A)!.parent).toBeNull();
    expect(scene.roots).toEqual([A]);
  });

  it('does not undo an add out from under children an untracked edit gave it', () => {
    const { scene, spec, add } = makeScene();
    add('g', 'group');
    scene.untracked(() => scene.add({ ...spec('a'), parent: G }));

    scene.undo();
    expect(scene.get(G)).toBeDefined();
    expect(scene.get(A)!.parent).toBe(G);
  });
});
