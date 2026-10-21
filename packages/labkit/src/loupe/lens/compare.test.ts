import type { InvocationCtx, Op } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import {
  createSeamPreview,
  lensSides,
  SEAM_GRAB,
  SEAM_LAYER_ID,
  seamAction,
  seamHit,
  splitRects,
} from './compare';
import { lensApiFixture } from './lensApi.fixture';
import { hitBoxesOf } from './lensHitBoxes';
import { addLensOps, setLensOps, settingsOf } from './lensScene';
import { BODY_SIZE, LENS_DEFAULTS } from './lensTypes';

/** A fixture with one split lens comparing against 'b', its body centered at (300, 200). */
function splitLens() {
  const api = lensApiFixture();
  const applied: (readonly Op[])[] = [];
  const apply = api.apply;
  api.apply = (ops) => {
    applied.push(ops);
    apply(ops);
  };
  const lensId = api.add() as string;
  api.apply(setLensOps(api.scene, lensId, { compare: 'b', view: 'split' }));
  applied.length = 0;
  return { api, lensId, applied };
}

const LEFT = 300 - BODY_SIZE / 2;
const TOP = 200 - BODY_SIZE / 2;

const ctxAt = (x: number, lensId?: string) =>
  ({
    world: { x, y: 200 },
    modifiers: {},
    deps: {},
    drag: {
      start: { x, y: 200 },
      current: { x, y: 200 },
      delta: { x: 0, y: 0 },
      ...(lensId ? { affordance: { kind: `layer:${SEAM_LAYER_ID}`, payload: { lensId } } } : {}),
    },
  }) as unknown as InvocationCtx;

describe('splitRects', () => {
  it('splits the interior at the seam', () => {
    expect(splitRects({ x: 0, y: 0, w: 100, h: 50 }, 0.3).seamX).toBe(30);
  });

  it('gives the left rect everything before the seam and the right everything after', () => {
    const { left, right, seamX } = splitRects({ x: 10, y: 5, w: 100, h: 50 }, 0.25);
    expect(seamX).toBe(35);
    expect(left).toEqual({ x: 10, y: 5, w: 25, h: 50 });
    expect(right).toEqual({ x: 35, y: 5, w: 75, h: 50 });
  });
});

describe('lensSides', () => {
  it('shows only the story with no comparison, whatever the view', () => {
    expect(lensSides({ ...LENS_DEFAULTS, view: 'split' })).toEqual(['base']);
  });

  it('shows only the compared render in Swap, and both in Split', () => {
    expect(lensSides({ ...LENS_DEFAULTS, compare: 'b', view: 'swap' })).toEqual(['compared']);
    expect(lensSides({ ...LENS_DEFAULTS, compare: 'b', view: 'split' })).toEqual(['base', 'compared']);
  });
});

describe('the seam', () => {
  it('gets a hit box of its own, SEAM_GRAB either side of it, above a split body', () => {
    const { api } = splitLens();
    const boxes = hitBoxesOf(api.scene, new Set());
    const seam = boxes.find((b) => b.role === 'lens-seam');
    expect(seam).toEqual({
      nodeId: 'l0:body',
      role: 'lens-seam',
      rect: { x: LEFT + BODY_SIZE / 2 - SEAM_GRAB, y: TOP, w: 2 * SEAM_GRAB, h: BODY_SIZE },
      round: false,
    });
    expect(boxes.indexOf(seam!)).toBeGreaterThan(boxes.findIndex((b) => b.role === 'lens-body'));
  });

  it('has no hit box while the lens shows Swap', () => {
    const { api, lensId } = splitLens();
    api.apply(setLensOps(api.scene, lensId, { view: 'swap' }));
    expect(hitBoxesOf(api.scene, new Set()).some((b) => b.role === 'lens-seam')).toBe(false);
  });

  it('is claimed by the seam layer within SEAM_GRAB of it, and nowhere else on the body', () => {
    const { api, lensId } = splitLens();
    const preview = createSeamPreview();
    const seamX = LEFT + BODY_SIZE / 2;
    expect(seamHit(api.scene, preview, seamX + SEAM_GRAB - 1, 200, 1)).toEqual({ lensId });
    expect(seamHit(api.scene, preview, seamX + SEAM_GRAB + 2, 200, 1)).toBeNull();
    // At 2× a grab of SEAM_GRAB screen px is half as many world px.
    expect(seamHit(api.scene, preview, seamX + SEAM_GRAB - 1, 200, 2)).toBeNull();
  });

  it('belongs to the lens on top: a press on lens B over A’s seam is B’s', () => {
    const { api, lensId } = splitLens();
    const preview = createSeamPreview();
    const seamX = LEFT + BODY_SIZE / 2;
    // B, added later, paints over A, covering the lower half of A's seam.
    api.apply(addLensOps(api.scene, 'b', { body: { x: seamX + 20, y: 200 + BODY_SIZE / 2 }, reticle: { x: 50, y: 50 } }));
    expect(seamHit(api.scene, preview, seamX, 250, 1)).toBeNull();
    expect(seamHit(api.scene, preview, seamX, 150, 1)).toEqual({ lensId });
  });

  it('previews a drag without writing to the scene, and commits one data op on release', () => {
    const { api, lensId, applied } = splitLens();
    const preview = createSeamPreview();
    const action = seamAction(api, preview);
    expect(action.id).toBe('loupe.seam');
    expect(action.defaultBinding).toEqual({ kind: 'drag', target: `affordance:layer:${SEAM_LAYER_ID}` });
    if (action.invoker?.timing !== 'ongoing') throw new Error('the seam is a drag');
    const handle = action.invoker.start(ctxAt(LEFT + BODY_SIZE / 2, lensId));
    handle.onMove?.(ctxAt(LEFT + BODY_SIZE * 0.75));
    expect(preview.get(lensId)).toBeCloseTo(0.75);
    expect(settingsOf(api.scene, lensId)?.seam).toBe(0.5);
    expect(applied).toEqual([]);
    handle.onEnd?.(ctxAt(LEFT + BODY_SIZE * 0.75), 'commit');
    expect(applied).toHaveLength(1);
    expect(applied[0]).toHaveLength(1);
    expect(applied[0]?.[0]?.name).toBe('setData');
    expect(settingsOf(api.scene, lensId)?.seam).toBeCloseTo(0.75);
    expect(preview.get(lensId)).toBeUndefined();
  });

  it('clamps the seam to [0.05, 0.95]', () => {
    const { api, lensId } = splitLens();
    const preview = createSeamPreview();
    const action = seamAction(api, preview);
    if (action.invoker?.timing !== 'ongoing') throw new Error('the seam is a drag');
    const handle = action.invoker.start(ctxAt(LEFT + BODY_SIZE / 2, lensId));
    handle.onMove?.(ctxAt(LEFT - 50));
    expect(preview.get(lensId)).toBe(0.05);
    handle.onMove?.(ctxAt(LEFT + BODY_SIZE + 50));
    expect(preview.get(lensId)).toBe(0.95);
  });

  it('leaves the scene alone when the drag is canceled', () => {
    const { api, lensId, applied } = splitLens();
    const preview = createSeamPreview();
    const action = seamAction(api, preview);
    if (action.invoker?.timing !== 'ongoing') throw new Error('the seam is a drag');
    const handle = action.invoker.start(ctxAt(LEFT + BODY_SIZE / 2, lensId));
    handle.onMove?.(ctxAt(LEFT + 20));
    handle.onEnd?.(ctxAt(LEFT + 20), 'cancel');
    expect(applied).toEqual([]);
    expect(preview.get(lensId)).toBeUndefined();
    expect(settingsOf(api.scene, lensId)?.seam).toBe(0.5);
  });
});
