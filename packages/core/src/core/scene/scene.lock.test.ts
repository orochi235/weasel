/**
 * A locked layer's nodes still paint, but nothing edits them: the scene
 * refuses the mutation, keeps them out of its selection, and rolls back any
 * batch that reaches one.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { asNodeId, type NodeId } from './types';
import type { Op } from 'core/ops/types';

type Layer = 'base' | 'art';
interface Data { label: string }

const POSE = { x: 0, y: 0, width: 10, height: 10 };
const MOVED = { x: 5, y: 5, width: 10, height: 10 };

function lockedScene() {
  const scene = createScene<Data, Layer>({
    systemLayers: [{ id: 'base' }, { id: 'art' }],
  });
  const free = scene.add({ kind: 'leaf', id: asNodeId('free'), layer: 'base', pose: POSE, data: { label: 'free' } });
  const box = scene.add({ kind: 'container', id: asNodeId('box'), layer: 'art', pose: POSE, data: { label: 'box' } });
  const kid = scene.add({ kind: 'leaf', id: asNodeId('kid'), layer: 'art', pose: POSE, data: { label: 'kid' }, parent: box });
  const art = scene.add({ kind: 'leaf', id: asNodeId('art'), layer: 'art', pose: POSE, data: { label: 'art' } });
  scene.setLayerLocked('art', true);
  return { scene, free, box, kid, art };
}

describe('Scene — isLocked', () => {
  it('answers from the node layer', () => {
    const { scene, free, art } = lockedScene();
    expect(scene.isLocked(art)).toBe(true);
    expect(scene.isLocked(free)).toBe(false);
  });

  it('a child inherits its container lock even on an unlocked layer', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'base' }, { id: 'art' }] });
    const box = scene.add({ kind: 'container', layer: 'base', pose: POSE, data: { label: 'box' } });
    const kid = scene.add({ kind: 'leaf', layer: 'art', pose: POSE, data: { label: 'kid' }, parent: box });
    scene.setLayerLocked('base', true);
    expect(scene.isLocked(kid)).toBe(true);
  });

  it('an unknown id is not locked', () => {
    const { scene } = lockedScene();
    expect(scene.isLocked(asNodeId('nope'))).toBe(false);
  });
});

describe('Scene — mutation guard', () => {
  it('refuses every node edit on a locked layer and records nothing', () => {
    const { scene, free, box, kid, art } = lockedScene();
    const depth = scene.historyIndex();
    const attempts: Array<[string, () => void]> = [
      ['setPose', () => scene.setPose(art, MOVED)],
      ['update', () => scene.update(art, { data: { label: 'x' } })],
      ['remove', () => scene.remove(art)],
      ['removeMany', () => scene.removeMany([free, art])],
      ['setLayer', () => scene.setLayer(art, 'art')],
      ['setLayer onto a locked layer', () => scene.setLayer(free, 'art')],
      ['setDependsOn', () => scene.setDependsOn(art, [free])],
      ['move', () => scene.move(kid, null)],
      ['move into a locked container', () => scene.move(free, box)],
      ['reorder', () => scene.reorder(kid, 0)],
      ['add onto a locked layer', () => scene.add({ kind: 'leaf', layer: 'art', pose: POSE, data: { label: 'n' } })],
      ['add under a locked container', () => scene.add({ kind: 'leaf', layer: 'art', pose: POSE, data: { label: 'n' }, parent: box })],
    ];
    for (const [name, attempt] of attempts) {
      expect(attempt, name).toThrow(/locked/);
    }
    expect(scene.get(art)!.pose).toEqual(POSE);
    expect(scene.get(art)!.data).toEqual({ label: 'art' });
    expect(scene.get(free)).toBeDefined();
    expect(scene.get(free)!.layer).toBe('base');
    expect(scene.get(kid)!.parent).toBe(box);
    expect(scene.historyIndex()).toBe(depth);
  });

  it('refuses a removal whose cascade reaches a locked dependent', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'base' }, { id: 'art' }] });
    const a = scene.add({ kind: 'leaf', layer: 'base', pose: POSE, data: { label: 'a' } });
    const edge = scene.add({ kind: 'leaf', layer: 'art', pose: POSE, data: { label: 'e' }, dependsOn: [a] });
    scene.setLayerLocked('art', true);
    expect(() => scene.remove(a)).toThrow(/locked/);
    expect(scene.get(a)).toBeDefined();
    expect(scene.get(edge)).toBeDefined();
  });

  it('never blocks the lock toggle itself, and unlocking restores every edit', () => {
    const { scene, art } = lockedScene();
    scene.setLayerLocked('art', false);
    scene.setPose(art, MOVED);
    expect(scene.get(art)!.pose).toEqual(MOVED);
    scene.setLayerLocked('art', true);
    expect(scene.layers.find((l) => l.id === 'art')!.locked).toBe(true);
  });

  it('leaves the other layer operations alone', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'base' }] });
    scene.addLayer({ id: 'art', name: 'Art', locked: true });
    scene.add({ kind: 'leaf', layer: 'base', pose: POSE, data: { label: 'b' } });
    scene.setLayerVisible('art', false);
    scene.renameLayer('art', 'Ink');
    scene.moveLayer('art', 0);
    expect(scene.layers.map((l) => l.id)).toEqual(['art', 'base']);
  });

  it('removeLayer takes a locked layer and its nodes as one step', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'base' }] });
    scene.addLayer({ id: 'art', name: 'Art' });
    const n = scene.add({ kind: 'leaf', layer: 'art', pose: POSE, data: { label: 'n' } });
    scene.setLayerLocked('art', true);
    scene.removeLayer('art');
    expect(scene.get(n)).toBeUndefined();
    scene.undo();
    expect(scene.get(n)).toBeDefined();
  });

  it('unlocked() is the explicit escape hatch', () => {
    const { scene, art } = lockedScene();
    scene.unlocked(() => scene.setPose(art, MOVED));
    expect(scene.get(art)!.pose).toEqual(MOVED);
    // Undo is not an edit: it restores a state that was legal when recorded.
    scene.undo();
    expect(scene.get(art)!.pose).toEqual(POSE);
    scene.redo();
    expect(scene.get(art)!.pose).toEqual(MOVED);
    expect(() => scene.setPose(art, POSE)).toThrow(/locked/);
  });

  it('construction and loadState place nodes on a locked layer', () => {
    const scene = createScene<Data, Layer>({
      systemLayers: [{ id: 'base', locked: true }],
      initial: [{ kind: 'leaf', id: asNodeId('n'), layer: 'base', pose: POSE, data: { label: 'n' } }],
    });
    expect(scene.get(asNodeId('n'))).toBeDefined();
    scene.loadState(scene.toJSON());
    expect(scene.get(asNodeId('n'))).toBeDefined();
  });
});

describe('Scene — a refused batch applies nothing', () => {
  const setPoseOp = (id: NodeId, from: typeof POSE, to: typeof POSE): Op => ({
    apply: (adapter) => { (adapter as { setPose(id: NodeId, p: typeof POSE): void }).setPose(id, to); },
    invert: () => setPoseOp(id, to, from),
  });

  it('applyBatch rolls back the unlocked half and records no entry', () => {
    const { scene, free, art } = lockedScene();
    const depth = scene.historyIndex();
    expect(() => scene.applyBatch(
      [setPoseOp(free, POSE, MOVED), setPoseOp(art, POSE, MOVED)], 'Move', scene,
    )).toThrow(/locked/);
    expect(scene.get(free)!.pose).toEqual(POSE);
    expect(scene.get(art)!.pose).toEqual(POSE);
    expect(scene.historyIndex()).toBe(depth);
  });

  it('batch rolls back the unlocked half and records no entry', () => {
    const { scene, free, art } = lockedScene();
    const depth = scene.historyIndex();
    expect(() => scene.batch('Move', () => {
      scene.setPose(free, MOVED);
      scene.setPose(art, MOVED);
    })).toThrow(/locked/);
    expect(scene.get(free)!.pose).toEqual(POSE);
    expect(scene.historyIndex()).toBe(depth);
    // The scene is still usable: the next batch records normally.
    scene.batch('Move', () => scene.setPose(free, MOVED));
    expect(scene.historyIndex()).toBe(depth + 1);
  });
});

describe('Scene — selection', () => {
  it('setSelection drops locked nodes', () => {
    const { scene, free, art, kid } = lockedScene();
    scene.setSelection([free, art, kid]);
    expect(scene.getSelection()).toEqual([free]);
  });

  it('locking a layer drops its nodes from the selection; undo puts them back', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'base' }, { id: 'art' }] });
    const free = scene.add({ kind: 'leaf', layer: 'base', pose: POSE, data: { label: 'f' } });
    const art = scene.add({ kind: 'leaf', layer: 'art', pose: POSE, data: { label: 'a' } });
    scene.setSelection([free, art]);
    scene.setLayerLocked('art', true);
    expect(scene.getSelection()).toEqual([free]);
    scene.undo();
    expect(scene.layers.find((l) => l.id === 'art')!.locked).toBe(false);
    expect(scene.getSelection()).toEqual([free, art]);
  });
});
