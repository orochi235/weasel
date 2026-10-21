import { type Op, sceneToAdapter } from '@weasel-js/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { HANDLE_SLOP, hitBoxesOf } from './lensHitBoxes';
import { addLensOps, createLensScene } from './lensScene';
import { BODY_SIZE, type LensScene } from './lensTypes';

let scene: LensScene<string>;
const apply = (ops: Op[]) => sceneToAdapter(scene).applyOps(ops, 'test');

beforeEach(() => {
  scene = createLensScene<string>();
  apply(addLensOps(scene, 'a', { body: { x: 300, y: 200 }, reticle: { x: 100, y: 100 } }));
});

describe('hitBoxesOf', () => {
  it('gives the body a box at its pose, the reticle one over the patch it aims at, and the leader none', () => {
    const boxes = hitBoxesOf(scene, new Set());
    expect(boxes.map((b) => b.role)).toEqual(['lens-body', 'lens-reticle']);
    expect(boxes[0]).toEqual({
      nodeId: 'a:body',
      role: 'lens-body',
      rect: { x: 300 - BODY_SIZE / 2, y: 200 - BODY_SIZE / 2, w: BODY_SIZE, h: BODY_SIZE },
      round: true,
    });
    const patch = BODY_SIZE / 4;
    expect(boxes[1]).toEqual({
      nodeId: 'a:reticle',
      role: 'lens-reticle',
      rect: { x: 100 - patch / 2, y: 100 - patch / 2, w: patch, h: patch },
      round: true,
    });
  });

  it('places boxes through the attachment’s view: a pane camera at 2× doubles the rects', () => {
    const view = { x: 10, y: 20, scale: { x: 2, y: 2 } };
    expect(hitBoxesOf(scene, new Set(), view)[0]?.rect).toEqual({
      x: (300 - BODY_SIZE / 2 - 10) * 2,
      y: (200 - BODY_SIZE / 2 - 20) * 2,
      w: BODY_SIZE * 2,
      h: BODY_SIZE * 2,
    });
  });

  it('grows a selected body’s box by the handle slop', () => {
    expect(HANDLE_SLOP).toBe(12);
    const body = hitBoxesOf(scene, new Set(['a:body']))[0];
    expect(body?.rect.w).toBe(BODY_SIZE + 24);
    expect(body?.rect.x).toBe(300 - BODY_SIZE / 2 - 12);
    expect(hitBoxesOf(scene, new Set(['a:reticle']))[1]?.rect.w).toBe(BODY_SIZE / 4);
  });

  it('squares a selected round body’s box, so the handles on its corners stay reachable', () => {
    expect(hitBoxesOf(scene, new Set())[0]?.round).toBe(true);
    expect(hitBoxesOf(scene, new Set(['a:body']))[0]?.round).toBe(false);
  });

  it('marks a square lens’s body and reticle boxes as not round', () => {
    scene = createLensScene<string>();
    apply(
      addLensOps(
        scene,
        'b',
        { body: { x: 0, y: 0 }, reticle: { x: 0, y: 0 } },
        { shape: 'square' },
      ),
    );
    expect(hitBoxesOf(scene, new Set()).map((b) => b.round)).toEqual([false, false]);
  });
});
