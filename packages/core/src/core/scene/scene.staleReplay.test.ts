import { describe, it, expect } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import { createSetPoseOp } from 'core/ops/setPose';
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

  it('walks past a hide and a lock of the node', () => {
    const { scene, add, depths } = makeScene();
    add('a');
    scene.setHidden(A, true);
    scene.setLocked(A, true);
    scene.untracked(() => scene.unlocked(() => scene.remove(A)));

    expect(scene.undo()).toBe(true);
    expect(scene.undo()).toBe(true);
    expect(depths()).toEqual([1, 2]);
    expect(scene.redo()).toBe(true);
    expect(scene.redo()).toBe(true);
    expect(depths()).toEqual([3, 0]);
  });

  it('walks past every declared-field edit of the node', () => {
    const { scene, add, depths } = makeScene();
    add('a');
    scene.setLod(A, [{ as: 'box', fromPx: 4 }]);
    scene.setUnits(A, { length: 'mm' } as never);
    scene.untracked(() => scene.remove(A));

    expect(scene.undo()).toBe(true);
    expect(scene.undo()).toBe(true);
    expect(depths()).toEqual([1, 2]);
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
      createSetPoseOp({ id: A, from: { ...POSE }, to: { ...POSE, x: 5 } }),
      createSetPoseOp({ id: B, from: { ...POSE }, to: { ...POSE, x: 7 } }),
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
      [createSetPoseOp({ id: A, from: { ...POSE }, to: { ...POSE, x: 5 } })], 'move', adapter,
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

  it('skips a move under a node an untracked edit put beneath it', () => {
    const { scene, add } = makeScene();
    add('a', 'group');
    add('b', 'group');
    scene.move(A, B);
    scene.undo();
    scene.untracked(() => scene.move(B, A));

    expect(scene.redo()).toBe(true);
    expect(scene.roots).toEqual([A]);
    expect(scene.get(A)!.parent).toBeNull();
    expect(scene.get(B)!.parent).toBe(A);
  });

  it('skips redoing a removal when an untracked edit moved one of its inner nodes out', () => {
    const { scene, spec, add } = makeScene();
    add('g', 'group');
    add('b', 'group');
    scene.add({ ...spec('a'), parent: G });
    scene.remove(G);
    scene.undo();
    scene.untracked(() => scene.move(A, B));

    expect(scene.redo()).toBe(true);
    expect(scene.get(G)).toBeDefined();
    expect(scene.childrenOf(G)).toEqual([]);
    expect(scene.get(A)!.parent).toBe(B);
    expect(scene.childrenOf(B)).toEqual([A]);
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

describe('Scene — replaying an entry whose layer an untracked edit took', () => {
  function layered() {
    const scene = createScene<{ label: string }, string>({ systemLayers: [{ id: 'default' }] });
    const add = (id: string, layer: string) =>
      scene.add({ id: asNodeId(id), kind: 'mark', layer, pose: { ...POSE }, data: { label: id } });
    return { scene, add };
  }

  it('undo walks past layer edits naming a layer that is gone and reaches the entries beneath', () => {
    const { scene, add } = layered();
    add('b', 'default');
    scene.setPose(B, { ...POSE, x: 7 });
    scene.addLayer({ id: 'L', name: 'L' });
    scene.setLayerVisible('L', false);
    scene.setLayerLocked('L', true);
    scene.renameLayer('L', 'M');
    scene.moveLayer('L', 0);
    scene.untracked(() => scene.removeLayer('L'));

    for (let i = 0; i < 5; i++) expect(scene.undo()).toBe(true);
    expect(scene.layers.map((l) => l.id)).toEqual(['default']);
    expect(scene.undo()).toBe(true);
    expect(scene.get(B)!.pose.x).toBe(0);
  });

  it('redo walks past a setLayer onto, and an add on, a layer that is gone', () => {
    const { scene, add } = layered();
    scene.addLayer({ id: 'L', name: 'L' });
    add('a', 'default');
    scene.setLayer(A, 'L');
    add('b', 'L');
    scene.undo();
    scene.undo();
    scene.untracked(() => scene.removeLayer('L'));

    expect(scene.redo()).toBe(true);
    expect(scene.get(A)!.layer).toBe('default');
    expect(scene.redo()).toBe(true);
    expect(scene.get(B)).toBeUndefined();
  });

  it('skips a move or an add under a node an untracked edit raised above it', () => {
    const { scene, add } = layered();
    scene.addLayer({ id: 'L', name: 'L' });
    scene.add({ id: G, kind: 'group', layer: 'default', pose: { ...POSE }, data: { label: 'g' } });
    add('a', 'default');
    scene.move(A, G);
    scene.add({ id: B, kind: 'mark', layer: 'default', pose: { ...POSE }, data: { label: 'b' }, parent: G });
    scene.undo();
    scene.undo();
    scene.untracked(() => scene.setLayer(G, 'L'));

    expect(scene.redo()).toBe(true);
    expect(scene.get(A)!.parent).toBeNull();
    expect(scene.redo()).toBe(true);
    expect(scene.get(B)).toBeUndefined();
  });

  it('skips undoing a setLayer that would put a node below its parent', () => {
    const { scene, add } = layered();
    scene.addLayer({ id: 'L', name: 'L' });
    scene.add({ id: G, kind: 'group', layer: 'default', pose: { ...POSE }, data: { label: 'g' } });
    scene.add({ id: A, kind: 'mark', layer: 'default', pose: { ...POSE }, data: { label: 'a' }, parent: G });
    add('b', 'default');
    scene.setLayer(A, 'L');
    scene.untracked(() => scene.setLayer(G, 'L'));

    expect(scene.undo()).toBe(true);
    expect(scene.get(A)!.layer).toBe('L');
  });

  it('skips redoing a setLayer that would put a node above its child', () => {
    const { scene } = layered();
    scene.addLayer({ id: 'L', name: 'L' });
    scene.add({ id: G, kind: 'group', layer: 'default', pose: { ...POSE }, data: { label: 'g' } });
    scene.setLayer(G, 'L');
    scene.undo();
    scene.untracked(() =>
      scene.add({ id: A, kind: 'mark', layer: 'default', pose: { ...POSE }, data: { label: 'a' }, parent: G }));

    expect(scene.redo()).toBe(true);
    expect(scene.get(G)!.layer).toBe('default');
  });

  it("replays a whole subtree's setLayer both ways, raised or lowered", () => {
    const { scene } = layered();
    scene.addLayer({ id: 'L', name: 'L' });
    scene.add({ id: G, kind: 'group', layer: 'default', pose: { ...POSE }, data: { label: 'g' } });
    scene.add({ id: A, kind: 'mark', layer: 'default', pose: { ...POSE }, data: { label: 'a' }, parent: G });
    const layers = () => [scene.get(G)!.layer, scene.get(A)!.layer];
    scene.setLayer(G, 'L');
    scene.setLayer(G, 'default');

    scene.undo();
    expect(layers()).toEqual(['L', 'L']);
    scene.undo();
    expect(layers()).toEqual(['default', 'default']);
    scene.redo();
    expect(layers()).toEqual(['L', 'L']);
    scene.redo();
    expect(layers()).toEqual(['default', 'default']);
  });

  it('replays a subtree setLayer that raises some nodes and lowers others', () => {
    const { scene } = layered();
    scene.addLayer({ id: 'L', name: 'L' });
    scene.addLayer({ id: 'M', name: 'M' });
    scene.add({ id: G, kind: 'group', layer: 'default', pose: { ...POSE }, data: { label: 'g' } });
    scene.add({ id: B, kind: 'group', layer: 'M', pose: { ...POSE }, data: { label: 'b' }, parent: G });
    scene.add({ id: A, kind: 'mark', layer: 'M', pose: { ...POSE }, data: { label: 'a' }, parent: B });
    const layers = () => [G, B, A].map((id) => scene.get(id)!.layer);
    scene.setLayer(G, 'L');

    scene.undo();
    expect(layers()).toEqual(['default', 'M', 'M']);
    scene.redo();
    expect(layers()).toEqual(['L', 'L', 'L']);
  });

  it('removes the layer an entry names, not the one an untracked move put at its old index', () => {
    const { scene } = layered();
    scene.addLayer({ id: 'L', name: 'L' });
    scene.addLayer({ id: 'M', name: 'M' });
    scene.untracked(() => scene.moveLayer('M', 0));
    scene.undo();
    expect(scene.layers.map((l) => l.id)).toEqual(['default', 'L']);
  });
});
