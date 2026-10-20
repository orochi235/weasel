import { describe, expect, it, vi } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { POSE, makeScene, type Data, type Layer } from './testing/makeScene';

const LAYERS = [{ id: 'background' }, { id: 'structures' }, { id: 'plantings' }] as const;

describe('scene document values', () => {
  it('sets, reads, and lists a value', () => {
    const s = makeScene();
    expect(s.doc.get('core:pages')).toBeUndefined();
    s.doc.set('core:pages', { pages: [{ id: 'a', width: 10, height: 20 }] });
    expect(s.doc.get('core:pages')).toEqual({ pages: [{ id: 'a', width: 10, height: 20 }] });
    expect(s.doc.keys()).toEqual(['core:pages']);
  });

  it('undoes and redoes a set, and a removal', () => {
    const s = makeScene();
    s.doc.set('k', 1);
    s.doc.set('k', 2);
    s.doc.set('k', undefined);
    expect(s.doc.get('k')).toBeUndefined();
    expect(s.doc.keys()).toEqual([]);
    s.undo();
    expect(s.doc.get('k')).toBe(2);
    s.undo();
    expect(s.doc.get('k')).toBe(1);
    s.undo();
    expect(s.doc.keys()).toEqual([]);
    s.redo();
    expect(s.doc.get('k')).toBe(1);
  });

  it('elides a set to a deep-equal value: no entry, no notify', () => {
    const s = makeScene();
    s.doc.set('k', { a: [1, 2] });
    const depth = s.historyIndex();
    const heard = vi.fn();
    s.subscribe(heard);
    s.doc.set('k', { a: [1, 2] });
    s.doc.set('missing', undefined);
    expect(s.historyIndex()).toBe(depth);
    expect(heard).not.toHaveBeenCalled();
  });

  it('notifies subscribers on a set', () => {
    const s = makeScene();
    const heard = vi.fn();
    s.subscribe(heard);
    s.doc.set('k', 'v');
    expect(heard).toHaveBeenCalled();
  });

  it('joins an enclosing batch as one entry with the node edits', () => {
    const s = makeScene();
    const before = s.historyIndex();
    s.batch('Both', () => {
      s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
      s.doc.set('k', 1);
    });
    expect(s.historyIndex()).toBe(before + 1);
    s.undo();
    expect(s.doc.get('k')).toBeUndefined();
    expect(s.nodes.size).toBe(0);
  });

  it('round-trips through toJSON, sceneFromJSON, and loadState', () => {
    const s = makeScene();
    expect(s.toJSON()).not.toHaveProperty('doc');
    s.doc.set('core:pages', { pages: [] });
    const json = JSON.parse(JSON.stringify(s.toJSON()));
    expect(json.doc).toEqual({ 'core:pages': { pages: [] } });

    expect(sceneFromJSON<Data, Layer, typeof POSE>(json).doc.get('core:pages')).toEqual({ pages: [] });

    const other = makeScene();
    other.doc.set('stale', true);
    other.loadState(json);
    expect(other.doc.keys()).toEqual(['core:pages']);
    expect(other.canUndo()).toBe(false);
  });

  it('starts from the doc option, outside history', () => {
    const s = createScene<Data, Layer>({ systemLayers: LAYERS, doc: { k: 1 } });
    expect(s.doc.get('k')).toBe(1);
    expect(s.canUndo()).toBe(false);
  });

  it('survives a serialized history', () => {
    const s = makeScene();
    s.doc.set('k', 1);
    const restored = makeScene();
    restored.loadState(s.toJSON());
    restored.restoreHistory(JSON.parse(JSON.stringify(s.serializeHistory())));
    restored.undo();
    expect(restored.doc.get('k')).toBeUndefined();
    restored.redo();
    expect(restored.doc.get('k')).toBe(1);
  });
});
