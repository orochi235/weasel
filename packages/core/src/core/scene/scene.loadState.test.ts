import { describe, it, expect } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';

const POSE = { x: 0, y: 0, width: 10, height: 10 };

function makeScene() {
  const scene = createScene<{ label: string }, 'default'>({ systemLayers: [{ id: 'default' }] });
  const add = (id: string) =>
    scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: { ...POSE }, data: { label: id } });
  return { scene, add };
}

describe('Scene — loadState', () => {
  it('refuses inside untracked, and leaves batches grouping edits afterward', () => {
    const { scene, add } = makeScene();
    add('a');
    const json = scene.toJSON();

    expect(() => scene.untracked(() => scene.loadState(json))).toThrow(/loadState/);
    expect(scene.get(asNodeId('a'))).toBeDefined();

    const depth = scene.history.undoDepth();
    scene.batch('two', () => { add('b'); add('c'); });
    expect(scene.history.undoDepth()).toBe(depth + 1);
    scene.undo();
    expect(scene.get(asNodeId('b'))).toBeUndefined();
    expect(scene.get(asNodeId('c'))).toBeUndefined();
  });

  it('refuses inside a batch, which keeps its own edits', () => {
    const { scene, add } = makeScene();
    const json = scene.toJSON();

    scene.batch('adds', () => {
      add('a');
      expect(() => scene.loadState(json)).toThrow(/loadState/);
    });
    expect(scene.get(asNodeId('a'))).toBeDefined();
    expect(scene.history.undoDepth()).toBe(1);
    scene.undo();
    expect(scene.get(asNodeId('a'))).toBeUndefined();
  });

  it('drops selected ids and overrides the loaded document does not carry over', () => {
    const { scene, add } = makeScene();
    add('a');
    const onlyA = scene.toJSON();
    add('b');
    scene.setSelection([asNodeId('a'), asNodeId('b')]);
    scene.overrides.set(asNodeId('a'), { alpha: 0.5 });

    scene.loadState(onlyA);
    expect(scene.getSelection()).toEqual([asNodeId('a')]);
    expect(scene.overrides.ids()).toEqual([]);
  });

  it('drops a selected id the loaded document puts on a locked layer', () => {
    const scene = createScene<{ label: string }, 'base' | 'art'>({ systemLayers: [{ id: 'base' }, { id: 'art' }] });
    const add = (id: string, layer: 'base' | 'art') =>
      scene.add({ id: asNodeId(id), kind: 'mark', layer, pose: { ...POSE }, data: { label: id } });
    add('free', 'base');
    add('art', 'art');
    scene.setLayerLocked('art', true);
    const locked = scene.toJSON();
    scene.setLayerLocked('art', false);
    scene.setSelection([asNodeId('free'), asNodeId('art')]);

    scene.loadState(locked);
    expect(scene.isLocked(asNodeId('art'))).toBe(true);
    expect(scene.getSelection()).toEqual([asNodeId('free')]);
  });
});
