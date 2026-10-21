import { createTransformOp, effectivePose, type Op, sceneToAdapter } from '@weasel-js/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { addLensOps, createLensScene, setAimOps } from './lensScene';
import type { LensScene } from './lensTypes';
import { reticleFollower } from './reticleFollower';

let scene: LensScene<string>;
const apply = (ops: Op[]) => sceneToAdapter(scene).applyOps(ops, 'test');
const poseOf = (id: string) => effectivePose(scene, scene.get(id as never)!);
// The body is 160 px about (300, 200) and the factor 4, so the reticle is 40 px about (100, 100).
const wider = { x: 220, y: 120, width: 240, height: 160 };

beforeEach(() => {
  scene = createLensScene<string>();
  apply(addLensOps(scene, 'a', { body: { x: 300, y: 200 }, reticle: { x: 100, y: 100 } }));
});

describe('reticleFollower', () => {
  it('previews a reticle at the patch a resized body would show, about its own center', () => {
    expect(reticleFollower(scene).preview(new Map([['a:body', wider]]), new Map())).toEqual([
      { id: 'a:reticle', pose: { x: 70, y: 80, width: 60, height: 40 } },
    ]);
  });

  it('adds nothing for a body that only moved', () => {
    const moved = { ...poseOf('a:body'), x: 0 };
    expect(reticleFollower(scene).preview(new Map([['a:body', moved]]), new Map())).toEqual([]);
  });

  it('finishes a resize with the reticle, so one undo puts both back', () => {
    const resize = createTransformOp({
      id: 'a:body',
      from: poseOf('a:body'),
      to: wider,
      label: 'Resize',
    });
    apply(reticleFollower(scene).finish([resize], 'Resize')!);
    expect(poseOf('a:reticle')).toEqual({ x: 70, y: 80, width: 60, height: 40 });
    scene.history.undo();
    expect(poseOf('a:reticle')).toEqual({ x: 80, y: 80, width: 40, height: 40 });
  });

  it('leaves a Glass reticle to derive', () => {
    apply(setAimOps(scene, 'a', 'glass'));
    expect(reticleFollower(scene).preview(new Map([['a:body', wider]]), new Map())).toEqual([]);
  });
});
