import { afterEach, describe, expect, it } from 'vitest';
import { RIGID_POSE_COMPOSITION, composeWorldPose, createScene, type RectPose } from '@weasel-js/core';
import V2_CONTAINERS from './fixtures/v2-containers.scene.json';
import { loadInitial, loadSceneHistory, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';

afterEach(() => localStorage.clear());

describe('draw scene loading', () => {
  it('starts with the welcome rectangle when nothing, or not a drawing, is saved', () => {
    expect(loadInitial().map((s) => s.id)).toEqual(['starter-1']);
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 4, nodes: [] }));
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

  it('removes an undo snapshot it cannot use', () => {
    localStorage.setItem(SCENE_HISTORY_KEY, JSON.stringify({ version: 1, form: 'older' }));
    expect(loadSceneHistory()).toBeNull();
    expect(localStorage.getItem(SCENE_HISTORY_KEY)).toBeNull();
  });
});
