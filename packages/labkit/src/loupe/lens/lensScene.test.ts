import {
  effectivePose,
  moveSources,
  type Op,
  type RectPose,
  sceneToAdapter,
} from '@weasel-js/core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addLensOps,
  createLensScene,
  LENS_REGISTRY,
  lensClosure,
  lensesOf,
  setAimOps,
  setLensOps,
  settingsOf,
} from './lensScene';
import type { LensScene } from './lensTypes';
import { GLASS_POSE_KEY, LEADER_PATH_KEY } from './lensTypes';

const centerOf = (p: RectPose) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

let scene: LensScene<string>;
const apply = (ops: Op[]) => sceneToAdapter(scene).applyOps(ops, 'test');
const poseOf = (id: string) => effectivePose(scene, scene.get(id as never)!);

beforeEach(() => {
  scene = createLensScene<string>();
  apply(addLensOps(scene, 'a', { body: { x: 300, y: 200 }, reticle: { x: 100, y: 100 } }));
});

describe('lens scene', () => {
  it('adds a lens as a body, a pinned reticle and a leader joining them', () => {
    expect(lensesOf(scene)).toEqual([
      { lensId: 'a', body: 'a:body', reticle: 'a:reticle', leader: 'a:leader' },
    ]);
    expect(scene.get('a:reticle' as never)!.dependsOn).toBeUndefined();
    expect(scene.get('a:leader' as never)!.dependsOn).toEqual(['a:body', 'a:reticle']);
    expect(settingsOf(scene, 'a')).toMatchObject({ aim: 'pinned', source: 'live', factor: 4 });
  });

  it('centers the body and the reticle on the points it was given', () => {
    expect(centerOf(poseOf('a:body'))).toEqual({ x: 300, y: 200 });
    expect(centerOf(poseOf('a:reticle'))).toEqual({ x: 100, y: 100 });
  });

  it('moves a pinned reticle on its own: dragging it writes the reticle, not the body', () => {
    expect(moveSources(scene, ['a:reticle'])).toEqual(['a:reticle']);
  });

  it('makes Glass two kit calls: the reticle sits at the body’s center, dragging it moves the body, and undo restores Pinned', () => {
    apply(setAimOps(scene, 'a', 'glass'));
    expect(centerOf(poseOf('a:reticle'))).toEqual({ x: 300, y: 200 });
    expect(moveSources(scene, ['a:reticle'])).toEqual(['a:body']);
    expect(settingsOf(scene, 'a')!.aim).toBe('glass');
    scene.history.undo();
    expect(scene.get('a:reticle' as never)!.dependsOn).toBeUndefined();
    expect(settingsOf(scene, 'a')!.aim).toBe('pinned');
    expect(centerOf(poseOf('a:reticle'))).toEqual({ x: 100, y: 100 });
  });

  it('leaves Glass with the reticle where it was drawn', () => {
    apply(setAimOps(scene, 'a', 'glass'));
    apply(setAimOps(scene, 'a', 'pinned'));
    expect(scene.get('a:reticle' as never)!.dependsOn).toBeUndefined();
    expect(centerOf(poseOf('a:reticle'))).toEqual({ x: 300, y: 200 });
  });

  it('undoes each aim change as its own step, restoring the previous aim and reticle pose', () => {
    const state = () => ({ aim: settingsOf(scene, 'a')!.aim, reticle: poseOf('a:reticle') });
    const pinned = state();
    apply(setAimOps(scene, 'a', 'glass'));
    const glass = state();
    apply(setAimOps(scene, 'a', 'pinned'));
    const planted = state();
    apply(setAimOps(scene, 'a', 'glass'));

    scene.history.undo();
    expect(state()).toEqual(planted);
    scene.history.undo();
    expect(state()).toEqual(glass);
    scene.history.undo();
    expect(state()).toEqual(pinned);
  });

  it('writes settings patches to the body and undoes them', () => {
    apply(setLensOps(scene, 'a', { factor: 8, view: 'split' }));
    expect(settingsOf(scene, 'a')).toMatchObject({ factor: 8, view: 'split', aim: 'pinned' });
    scene.history.undo();
    expect(settingsOf(scene, 'a')).toMatchObject({ factor: 4, view: 'swap' });
  });

  it('draws the leader from the body’s rim to the reticle, and not at all while the reticle is inside the body', () => {
    const leader = () => scene.get('a:leader' as never)!;
    const bounds = () => {
      const path = (leader() as { derivePath?: unknown }).derivePath as
        | ((n: unknown, d: unknown[]) => { coords: Float32Array } | null)
        | undefined;
      const dep = (id: string) => ({ node: scene.get(id as never)!, pose: poseOf(id), path: null });
      return path!(leader(), [dep('a:body'), dep('a:reticle')]);
    };
    const outside = bounds()!;
    // Body center (300,200), reticle center (100,100): the rim is 80 along that line.
    const d = Math.hypot(200, 100);
    expect(outside.coords[0]).toBeCloseTo(300 - (200 / d) * 80, 3);
    expect(outside.coords[1]).toBeCloseTo(200 - (100 / d) * 80, 3);
    expect([outside.coords[2], outside.coords[3]]).toEqual([100, 100]);

    scene.setPose('a:reticle' as never, { x: 292, y: 192, width: 16, height: 16 });
    expect(bounds()).toBeNull();
  });

  it('closes over whole lenses from any one of their nodes', () => {
    apply(addLensOps(scene, 'b', { body: { x: 600, y: 200 }, reticle: { x: 500, y: 100 } }));
    expect(lensClosure(scene, ['a:reticle']).sort()).toEqual(['a:body', 'a:leader', 'a:reticle']);
    expect(lensClosure(scene, ['a:body', 'b:leader']).sort()).toEqual([
      'a:body',
      'a:leader',
      'a:reticle',
      'b:body',
      'b:leader',
      'b:reticle',
    ]);
  });

  it('round-trips through a serialized history with the glass and leader functions restored by key', () => {
    apply(setAimOps(scene, 'a', 'glass'));
    const restored = createLensScene<string>();
    restored.loadState(scene.toJSON());
    restored.restoreHistory(scene.serializeHistory());

    expect(Object.keys(LENS_REGISTRY.derivePose)).toEqual([GLASS_POSE_KEY]);
    expect(Object.keys(LENS_REGISTRY.derivePath)).toEqual([LEADER_PATH_KEY]);
    for (const id of ['a:body', 'a:reticle'] as const) {
      expect(effectivePose(restored, restored.get(id as never)!)).toEqual(poseOf(id));
    }
    expect(restored.toJSON().nodes.find((n) => n.id === 'a:reticle')).toMatchObject({
      derivePoseKey: GLASS_POSE_KEY,
    });
    expect(restored.toJSON().nodes.find((n) => n.id === 'a:leader')).toMatchObject({
      derivePathKey: LEADER_PATH_KEY,
    });

    restored.history.undo();
    expect(restored.get('a:reticle' as never)!.dependsOn).toBeUndefined();
    restored.history.undo();
    expect(restored.get('a:body' as never)).toBeUndefined();
    restored.history.redo();
    restored.history.redo();
    expect(restored.get('a:reticle' as never)!.dependsOn).toEqual(['a:body']);
    expect(centerOf(effectivePose(restored, restored.get('a:reticle' as never)!))).toEqual({
      x: 300,
      y: 200,
    });
  });
});
