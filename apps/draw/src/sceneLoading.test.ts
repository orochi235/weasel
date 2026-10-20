import { afterEach, describe, expect, it } from 'vitest';
import { loadInitial, loadSceneHistory, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';

afterEach(() => localStorage.clear());

describe('draw scene loading', () => {
  it('starts with the welcome rectangle when nothing, or not a drawing, is saved', () => {
    expect(loadInitial().map((s) => s.id)).toEqual(['starter-1']);
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 2, nodes: [] }));
    expect(loadInitial().map((s) => s.id)).toEqual(['starter-1']);
  });

  it('loads a saved drawing', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 1, nodes: [] }));
    expect(loadInitial()).toEqual([]);
  });

  it('removes an undo snapshot it cannot use', () => {
    localStorage.setItem(SCENE_HISTORY_KEY, JSON.stringify({ version: 1, form: 'older' }));
    expect(loadSceneHistory()).toBeNull();
    expect(localStorage.getItem(SCENE_HISTORY_KEY)).toBeNull();
  });
});
