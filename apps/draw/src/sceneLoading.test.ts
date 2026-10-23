import { afterEach, describe, expect, it } from 'vitest';
import { loadInitial, loadSceneHistory, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';

afterEach(() => localStorage.clear());

describe('draw scene loading', () => {
  it('starts with the welcome rectangle when nothing, or not a drawing, is saved', () => {
    expect(loadInitial().map((s) => s.id)).toEqual(['starter-1']);
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 3, nodes: [] }));
    expect(loadInitial().map((s) => s.id)).toEqual(['starter-1']);
  });

  it('loads a saved drawing', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 1, nodes: [] }));
    expect(loadInitial()).toEqual([]);
  });

  it('loads a version 1 drawing with its containers as groups and its leaves as marks', () => {
    const node = (id: string, kind: string) => ({ id, kind, layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 1, nodes: [node('c', 'container'), node('l', 'leaf')] }));
    expect(loadInitial().map((s) => s.kind)).toEqual(['group', 'mark']);
  });

  it('loads a version 2 drawing as saved', () => {
    const node = (id: string, kind: string) => ({ id, kind, layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 2, nodes: [node('g', 'group'), node('m', 'mark')] }));
    expect(loadInitial().map((s) => s.kind)).toEqual(['group', 'mark']);
  });

  it('removes an undo snapshot it cannot use', () => {
    localStorage.setItem(SCENE_HISTORY_KEY, JSON.stringify({ version: 1, form: 'older' }));
    expect(loadSceneHistory()).toBeNull();
    expect(localStorage.getItem(SCENE_HISTORY_KEY)).toBeNull();
  });
});
