import { type Op, sceneToAdapter } from '@weasel-js/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { HANDLE_SLOP, hitBoxesOf } from './lensHitBoxes';
import { addLensOps, createLensScene } from './lensScene';
import { BODY_SIZE, type LensScene, RETICLE_SIZE } from './lensTypes';

let scene: LensScene<string>;
const apply = (ops: Op[]) => sceneToAdapter(scene).applyOps(ops, 'test');

beforeEach(() => {
  scene = createLensScene<string>();
  apply(addLensOps(scene, 'a', { body: { x: 300, y: 200 }, reticle: { x: 100, y: 100 } }));
});

describe('hitBoxesOf', () => {
  it('gives each body and reticle a box at its effective pose, and none to the leader', () => {
    const boxes = hitBoxesOf(scene, new Set());
    expect(boxes.map((b) => b.role)).toEqual(['lens-body', 'lens-reticle']);
    expect(boxes[0]).toEqual({
      nodeId: 'a:body',
      role: 'lens-body',
      rect: { x: 300 - BODY_SIZE / 2, y: 200 - BODY_SIZE / 2, w: BODY_SIZE, h: BODY_SIZE },
      round: true,
    });
    expect(boxes[1]?.rect).toEqual({
      x: 100 - RETICLE_SIZE / 2,
      y: 100 - RETICLE_SIZE / 2,
      w: RETICLE_SIZE,
      h: RETICLE_SIZE,
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
    expect(hitBoxesOf(scene, new Set(['a:reticle']))[1]?.rect.w).toBe(RETICLE_SIZE);
  });

  it('marks a square lens’s body box as not round', () => {
    scene = createLensScene<string>();
    apply(
      addLensOps(
        scene,
        'b',
        { body: { x: 0, y: 0 }, reticle: { x: 0, y: 0 } },
        { shape: 'square' },
      ),
    );
    expect(hitBoxesOf(scene, new Set())[0]?.round).toBe(false);
  });
});
