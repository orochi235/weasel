import { describe, expect, it } from 'vitest';
import { createCornerResizeAffordance, type CornerResizeScratch } from './cornerResize';
import { composeAffordanceLayer } from './composeAffordanceLayer';
import { hitAffordanceRegions, pointRegionScreenQuad, transformOf } from './hitAffordanceRegions';
import type { ChromeState } from 'core/selection/chromeState';
import { asNodeId } from 'core/scene/types';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/select';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 400, height: 400, dpr: 1 };

function stateWithSingle(): ChromeState {
  return {
    selection: [asNodeId('a')],
    multiActive: false,
    boundsOf: () => ({ x: 100, y: 100, width: 50, height: 40 }),
    unionBounds: null,
    modifiers: NO_MOD,
  };
}

function stateWithMulti(): ChromeState {
  return {
    selection: [asNodeId('a'), asNodeId('b')],
    multiActive: true,
    boundsOf: (id) => id === 'a'
      ? { x: 0, y: 0, width: 50, height: 50 }
      : { x: 100, y: 100, width: 50, height: 50 },
    unionBounds: { x: 0, y: 0, width: 150, height: 150 },
    modifiers: NO_MOD,
  };
}

describe('createCornerResizeAffordance', () => {
  it('exposes a stable id for visibility maps', () => {
    const aff = createCornerResizeAffordance();
    expect(aff.id).toBe('selection.resize-handles');
  });

  it('produces no regions when no selection', () => {
    const aff = createCornerResizeAffordance();
    const state: ChromeState = {
      selection: [],
      multiActive: false,
      boundsOf: () => null,
      unionBounds: null,
      modifiers: NO_MOD,
    };
    expect(aff.regions(state)).toEqual([]);
  });

  it('produces a point region per corner and edge for a single selection in single-mode', () => {
    const aff = createCornerResizeAffordance();
    const regions = aff.regions(stateWithSingle());
    expect(regions).toHaveLength(8);
    for (const r of regions) {
      expect(r.shape.kind).toBe('point');
      expect(r.targetId).toBe('a');
    }
  });

  it('produces 8 point regions for the union AABB in multi-mode', () => {
    const aff = createCornerResizeAffordance();
    const regions = aff.regions(stateWithMulti());
    expect(regions).toHaveLength(8);
    for (const r of regions) {
      expect(r.targetId).toBe(MULTI_RESIZE_TARGET_ID);
    }
  });

  it('layer hitTest returns null when cursor is far from any handle', () => {
    const aff = createCornerResizeAffordance();
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    expect(layer.hitTest(50, 50, stateWithSingle(), VIEW, DIMS)).toBeNull();
  });

  it('layer hitTest claims when cursor is on a corner handle', () => {
    const aff = createCornerResizeAffordance({ handleHitRadius: 8 });
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    // Selection at (100, 100, 50, 40). Top-left corner is (100, 100).
    const result = layer.hitTest(100, 100, stateWithSingle(), VIEW, DIMS);
    expect(result).not.toBeNull();
    expect(result?.initialScratch).toBeDefined();
  });

  it('layer hitTest initialScratch identifies the picked anchor + target', () => {
    const aff = createCornerResizeAffordance({ handleHitRadius: 8 });
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    // Bottom-right corner of (100, 100, 50, 40) is (150, 140). Anchor pins
    // the opposite corner: { x: 'min', y: 'min' }.
    const result = layer.hitTest(150, 140, stateWithSingle(), VIEW, DIMS);
    expect(result?.initialScratch as CornerResizeScratch).toEqual({
      anchor: { x: 'min', y: 'min' },
      targetId: 'a',
      // World-space fixed corner, resolved by the affordance because
      // `resizeAction` scales from it and has no target transform.
      fixedPoint: { x: 100, y: 100 },
    });
  });

  it('layer hitTest in multi-mode targets the synthetic union', () => {
    const aff = createCornerResizeAffordance({ handleHitRadius: 8 });
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    // Union bounds are (0, 0, 150, 150). Top-left is (0, 0). Anchor pins BR.
    const result = layer.hitTest(0, 0, stateWithMulti(), VIEW, DIMS);
    expect(result?.initialScratch as CornerResizeScratch).toEqual({
      anchor: { x: 'max', y: 'max' },
      targetId: MULTI_RESIZE_TARGET_ID,
      fixedPoint: { x: 150, y: 150 },
    });
  });

  it('hits a rotated rect at its rotated visual corner', () => {
    // Bounds (100, 100, 50, 40), rotated 90° around its center (125, 120).
    // Local top-left (100, 100) under +90° rotation lands at world (145, 95).
    const state: ChromeState = {
      selection: [asNodeId('a')],
      multiActive: false,
      boundsOf: () => ({ x: 100, y: 100, width: 50, height: 40, rotation: Math.PI / 2 }),
      unionBounds: null,
      modifiers: NO_MOD,
    };
    const aff = createCornerResizeAffordance({ handleHitRadius: 8 });
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    expect(layer.hitTest(145, 95, state, VIEW, DIMS)).not.toBeNull();
    // A point well outside the rotated handle positions should miss.
    // Rotated handles are at ~(145,95), (145,145), (105,95), (105,145);
    // (75, 75) is at least 22 world-px from all of them.
    expect(layer.hitTest(75, 75, state, VIEW, DIMS)).toBeNull();
  });
});

/** Bounds carrying a pose rotation, which `poseRotationOf` reads. */
function stateRotated(rotation: number): ChromeState {
  return {
    selection: [asNodeId('a')],
    multiActive: false,
    boundsOf: () => ({ x: 100, y: 100, width: 50, height: 40, rotation }),
    unionBounds: null,
    modifiers: NO_MOD,
  };
}

const cursorOf = (state: ChromeState, tag: string) => {
  const r = createCornerResizeAffordance().regions(state).find((x) => x.id === `corner-${tag}`);
  return r?.cursor;
};

describe('corner-resize cursors', () => {
  it('picks the diagonal by corner parity on an unrotated target', () => {
    // Tags name the FIXED corner: `min-min` fixed means the dragged corner is
    // bottom-right, on the ↘ diagonal. The glyph is horizontal at angle 0, so
    // that diagonal is a quarter-turn's half.
    expect(cursorOf(stateWithSingle(), 'min-min')).toMatchObject({
      glyph: 'resize',
      angle: Math.PI / 4,
      fallback: 'nwse-resize',
    });
    expect(cursorOf(stateWithSingle(), 'max-min')).toMatchObject({
      glyph: 'resize',
      angle: -Math.PI / 4,
      fallback: 'nesw-resize',
    });
  });

  it('turns the diagonal with the target', () => {
    // The whole point of arc 2: at 90° the ↘ corner's resize axis runs ↙,
    // which no CSS keyword pair can express and the old parity rule got wrong.
    expect(cursorOf(stateRotated(Math.PI / 2), 'min-min')).toMatchObject({
      angle: Math.PI / 4 + Math.PI / 2,
    });
  });

  it('keeps a keyword fallback matching the unrotated diagonal', () => {
    // The image is what carries the rotation; if the browser drops it, the
    // parity keyword is still a better answer than `default`.
    const c = cursorOf(stateRotated(Math.PI / 3), 'min-min');
    expect(c).toMatchObject({ fallback: 'nwse-resize' });
  });
});

describe('corner handles on a small selection', () => {
  const small = (): ChromeState => ({
    ...stateWithSingle(),
    boundsOf: () => ({ x: 100, y: 100, width: 12, height: 12 }),
  });
  const hitAt = (x: number, y: number, state: ChromeState, scale = 1): string | undefined =>
    hitAffordanceRegions(
      [createCornerResizeAffordance()], x, y, state, { x: 0, y: 0, scale: { x: scale, y: scale } },
    )?.region.hitKind;

  it('leaves the body of a 12 px selection free, and takes a press outside each corner', () => {
    for (const [x, y] of [[106, 106], [101, 101], [111, 111], [101, 111]]) {
      expect(hitAt(x, y, small())).toBeUndefined();
    }
    expect(hitAt(97, 97, small())).toBe('handle:top-left');
    expect(hitAt(115, 97, small())).toBe('handle:top-right');
    expect(hitAt(97, 115, small())).toBe('handle:bottom-left');
    expect(hitAt(115, 115, small())).toBe('handle:bottom-right');
  });

  it('cuts each axis on its own: a narrow, tall selection keeps the full height of each square', () => {
    const narrow: ChromeState = { ...stateWithSingle(), boundsOf: () => ({ x: 100, y: 100, width: 12, height: 200 }) };
    expect(hitAt(97, 104, narrow)).toBe('handle:top-left');
    expect(hitAt(103, 104, narrow)).toBeUndefined();
  });

  it('takes the whole square once the selection spans four hit radii on screen', () => {
    // 12 world units at 4x is 48 px, over the 32 px floor.
    expect(hitAt(101, 101, small(), 4)).toBe('handle:top-left');
    expect(hitAt(101, 101, stateWithSingle())).toBe('handle:top-left');
  });

  it('records the narrowed square as the debug hitbox', () => {
    const [topLeft] = createCornerResizeAffordance().regions(small());
    if (topLeft.shape.kind !== 'point') throw new Error('expected a point region');
    const quad = pointRegionScreenQuad(topLeft.shape, transformOf(small(), 'a'), VIEW, (x, y) => [x, y]);
    expect(quad).toEqual([{ x: 92, y: 92 }, { x: 100, y: 92 }, { x: 100, y: 100 }, { x: 92, y: 100 }]);
  });
});

describe('edge handles', () => {
  // 100 x 60: both sides clear the 48 px floor at the default 8 px radius.
  const roomy = (rotation = 0): ChromeState => ({
    ...stateWithSingle(),
    boundsOf: () => ({ x: 100, y: 100, width: 100, height: 60, rotation }),
  });
  const hitAt = (x: number, y: number, state: ChromeState, opts = {}, scale = 1) =>
    hitAffordanceRegions(
      [createCornerResizeAffordance(opts)], x, y, state, { x: 0, y: 0, scale: { x: scale, y: scale } },
    );

  it('takes a press at each edge midpoint, pinning the opposite edge', () => {
    expect(hitAt(150, 100, roomy())?.region.hitKind).toBe('handle:top');
    expect(hitAt(200, 130, roomy())?.region.hitKind).toBe('handle:right');
    expect(hitAt(150, 160, roomy())?.region.hitKind).toBe('handle:bottom');
    expect(hitAt(100, 130, roomy())?.region.hitKind).toBe('handle:left');
    expect(hitAt(204, 130, roomy())?.binding.initialScratch).toEqual({
      anchor: { x: 'min', y: 'free' },
      targetId: 'a',
      fixedPoint: { x: 100, y: 130 },
    });
  });

  it('still gives the corners their own presses', () => {
    expect(hitAt(200, 100, roomy())?.region.hitKind).toBe('handle:top-right');
  });

  it('shows a resize cursor along the axis the handle drags, turned with the target', () => {
    const cursorAt = (x: number, y: number, s: ChromeState) => hitAt(x, y, s)?.cursor;
    expect(cursorAt(200, 130, roomy())).toMatchObject({ glyph: 'resize', angle: 0, fallback: 'ew-resize' });
    expect(cursorAt(150, 160, roomy())).toMatchObject({ glyph: 'resize', angle: Math.PI / 2, fallback: 'ns-resize' });
    // Turned 90° about (150, 130), the local right midpoint lands at (150, 180).
    expect(cursorAt(150, 180, roomy(Math.PI / 2))).toMatchObject({ angle: Math.PI / 2 });
  });

  it('hides them on a side under six hit radii on screen, and brings them back zoomed in', () => {
    // 50 x 40 at scale 1: 40 < 48, so neither pair is offered.
    expect(hitAt(150, 120, stateWithSingle())).toBeNull();
    expect(hitAt(125, 100, stateWithSingle())).toBeNull();
    // At 2x the same body spans 100 x 80 px.
    expect(hitAt(150, 120, stateWithSingle(), {}, 2)?.region.hitKind).toBe('handle:right');
  });

  it('can be left out', () => {
    expect(createCornerResizeAffordance({ edges: false }).regions(roomy())).toHaveLength(4);
    expect(hitAt(200, 130, roomy(), { edges: false })).toBeNull();
  });

  it('paints only the edge handles that fit', () => {
    const squares = (state: ChromeState) =>
      composeAffordanceLayer('x', 'X', [createCornerResizeAffordance()]).draw(state, VIEW, DIMS).length;
    expect(squares(roomy())).toBe(2 * squares(stateWithSingle()));
  });
});
