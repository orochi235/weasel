import { afterEach, describe, expect, it } from 'vitest';
import {
  RIGID_POSE_COMPOSITION, SCENE_HISTORY_FORM, composeWorldPose, createScene, isPageStructure, pagesOf, type RectPose,
} from '@weasel-js/core';
import V2_CONTAINERS from './fixtures/v2-containers.scene.json';
import { DOC_KEY } from './docPersistence';
import { loadInitial, loadInitialDoc, loadSceneHistory, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';

afterEach(() => localStorage.clear());

const LETTER = { width: 816, height: 1056 };
const node = (id: string, kind: string, x = 0) => ({ id, kind, layer: 'default', pose: { x, y: 0, width: 10, height: 10 }, data: {} });
const save = (json: object) => localStorage.setItem(LS_KEY, JSON.stringify({ systemLayers: [{ id: 'default' }], ...json }));
/** What `loadInitial` gives, as a scene. */
const loaded = () => createScene({ systemLayers: [{ id: 'default' }], initial: loadInitial() as never });
/** Every spec but the page run and the pages. */
const content = () => loadInitial().filter((s) => !isPageStructure(s));

describe('draw document values', () => {
  it('has none for a fresh drawing, and none of its pages for a saved one', () => {
    expect(loadInitialDoc()).toBeUndefined();
    save({ version: 2, nodes: [], doc: { 'core:pages': { pages: [{ id: 'page-1', ...LETTER }] }, units: 'mm' } });
    expect(loadInitialDoc()).toEqual({ units: 'mm' });
  });

  it('takes in a background saved beside the scene where the scene names none', () => {
    localStorage.setItem(DOC_KEY, JSON.stringify({ filename: 'old.svg', backgroundColor: '#ffcc00' }));
    expect(loadInitialDoc()).toEqual({ 'draw:background': '#ffcc00' });
    save({ version: 2, nodes: [], doc: { 'draw:background': '#112233' } });
    expect(loadInitialDoc()).toEqual({ 'draw:background': '#112233' });
  });
});

describe('draw pages', () => {
  it('starts a fresh drawing as one Letter page, the welcome rectangle on it', () => {
    const scene = loaded();
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', ...LETTER }]);
    expect(scene.get('starter-1' as never)).toMatchObject({ parent: 'page-1', pose: { x: 80, y: 80 } });
  });

  it('keeps the page run laid out and each page clipping, fresh and through a reload', () => {
    const check = () => {
      const specs = loadInitial();
      expect(specs.find((s) => s.pageRun)?.layout).toBeDefined();
      expect(specs.find((s) => s.page)?.clipFromPose).toBeDefined();
    };
    check();
    save(loaded().toJSON());
    check();
  });

  it('brings back the pages a drawing saved as a document value, each root on its page', () => {
    const pages = [{ id: 'page-1', width: 794, height: 1123 }, { id: 'page-2', name: 'Back', ...LETTER }];
    save({ version: 2, nodes: [node('m', 'mark', 794 + 40 + 5)], doc: { 'core:pages': { pages } } });
    const scene = loaded();
    expect(pagesOf(scene)?.pages).toEqual(pages);
    expect(scene.get('m' as never)).toMatchObject({ parent: 'page-2', pose: { x: 5 } });
  });

  it('opens a drawing saved before pages as one page of the paper size its settings kept', () => {
    save({ version: 2, nodes: [node('m', 'mark', 5)] });
    localStorage.setItem(DOC_KEY, JSON.stringify({ filename: 'old.svg', backgroundColor: '#fff', paperSize: 'legal' }));
    const scene = loaded();
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: 816, height: 1344 }]);
    expect(scene.get('m' as never)).toMatchObject({ parent: 'page-1', pose: { x: 5 } });
  });

  it('opens a drawing saved with page nodes as it was', () => {
    const scene = loaded();
    save(scene.toJSON());
    const tree = (specs: readonly { id?: string; parent?: string | null }[]) => specs.map((n) => [n.id, n.parent ?? null]);
    expect(tree(loadInitial())).toEqual(tree(scene.toJSON().nodes));
    expect(loaded().get('starter-1' as never)).toMatchObject({ parent: 'page-1', pose: { x: 80 } });
  });

  it('drops the undo stack saved beside a drawing whose pages were not yet nodes, and keeps one beside one whose were', () => {
    const history = JSON.stringify({ version: 1, form: SCENE_HISTORY_FORM, entries: [] });
    save({ version: 3, nodes: [] });
    localStorage.setItem(SCENE_HISTORY_KEY, history);
    loadInitial();
    expect(loadSceneHistory()).toBeNull();
    expect(localStorage.getItem(SCENE_HISTORY_KEY)).toBeNull();

    save(loaded().toJSON());
    localStorage.setItem(SCENE_HISTORY_KEY, history);
    loadInitial();
    expect(loadSceneHistory()).not.toBeNull();
  });
});

describe('draw scene loading', () => {
  it('starts with the welcome rectangle when nothing, or not a drawing, is saved', () => {
    expect(content().map((s) => s.id)).toEqual(['starter-1']);
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 4, nodes: [] }));
    expect(content().map((s) => s.id)).toEqual(['starter-1']);
  });

  it('loads a saved drawing', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 1, nodes: [] }));
    expect(content()).toEqual([]);
  });

  it('loads a version 1 drawing with its containers as groups and its leaves as marks', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 1, nodes: [node('c', 'container'), node('l', 'leaf')] }));
    expect(content().map((s) => s.kind)).toEqual(['group', 'mark']);
  });

  it('loads a version 2 drawing as saved', () => {
    save({ version: 2, nodes: [node('g', 'group'), node('m', 'mark')] });
    expect(content().map((s) => s.kind)).toEqual(['group', 'mark']);
  });

  it('opens a version 2 drawing with every node where it drew, each child now in its container\'s frame', () => {
    localStorage.setItem(LS_KEY, JSON.stringify(V2_CONTAINERS));
    const scene = createScene({ systemLayers: [{ id: 'default' }], initial: loadInitial() as never });
    const poses = {
      getPose: (id: string) => scene.get(id as never)!.pose as RectPose,
      getParent: (id: string) => scene.get(id as never)?.parent ?? null,
      definesFrame: (id: string) => scene.get(id as never)?.derivePose === undefined,
    };
    for (const saved of V2_CONTAINERS.nodes) {
      if (saved.id === 'env') continue;
      const world = composeWorldPose(poses, saved.id, RIGID_POSE_COMPOSITION.compose);
      expect(world.x, saved.id).toBeCloseTo(saved.pose.x);
      expect(world.y, saved.id).toBeCloseTo(saved.pose.y);
      expect(world.rotation ?? 0, saved.id).toBeCloseTo(saved.pose.rotation ?? 0);
    }
    expect(scene.get('a' as never)!.pose).toMatchObject({ x: 20, y: 20 });
    // An envelope is no frame: its children stay as they were.
    expect(scene.get('d' as never)!.pose).toMatchObject({ x: 220, y: 420 });
  });

  it('drops the undo stack saved beside a drawing it cannot open, which loads as the starter scene', () => {
    const history = JSON.stringify({ version: 1, form: SCENE_HISTORY_FORM, entries: [] });
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 4, nodes: [] }));
    localStorage.setItem(SCENE_HISTORY_KEY, history);
    loadInitial();
    expect(loadSceneHistory()).toBeNull();

    localStorage.removeItem(LS_KEY);
    localStorage.setItem(SCENE_HISTORY_KEY, history);
    loadInitial();
    expect(loadSceneHistory()).toBeNull();
  });

  it('starts with the welcome rectangle, keeping the saved drawing aside, when this build cannot hold what it saved', () => {
    const history = JSON.stringify({ version: 1, form: SCENE_HISTORY_FORM, entries: [] });
    const starter = loaded().toJSON();
    const unheld = [{ layer: 'later' }, { parent: 'gone' }];
    for (const change of unheld) {
      localStorage.clear();
      const nodes = starter.nodes.map((n) => (n.id === 'starter-1' ? { ...n, id: 'mine', ...change } : n));
      const saved = JSON.stringify({ ...starter, nodes });
      localStorage.setItem(LS_KEY, saved);
      localStorage.setItem(SCENE_HISTORY_KEY, history);
      expect(content().map((s) => s.id)).toEqual(['starter-1']);
      expect(localStorage.getItem(`${LS_KEY}:unreadable`)).toBe(saved);
      expect(loadSceneHistory()).toBeNull();
    }
  });

  it('removes an undo snapshot it cannot use', () => {
    localStorage.setItem(SCENE_HISTORY_KEY, JSON.stringify({ version: 1, form: 'older' }));
    expect(loadSceneHistory()).toBeNull();
    expect(localStorage.getItem(SCENE_HISTORY_KEY)).toBeNull();
  });
});
