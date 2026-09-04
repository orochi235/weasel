import { describe, expect, it } from 'vitest';
import { createRotationAffordance, type RotationScratch } from './rotationHandle';
import { composeAffordanceLayer } from './composeAffordanceLayer';
import { annulusSemiAxes } from './hitAffordanceRegions';
import type { ChromeState } from 'core/selection/chromeState';
import { asNodeId } from 'core/scene/types';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/shared/selectionTarget';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 400, height: 400 };

function stateWithSingle(rotation = 0): ChromeState {
  return {
    selection: [asNodeId('a')],
    multiActive: false,
    boundsOf: () => ({ x: 0, y: 0, width: 100, height: 100, ...(rotation ? { rotation } : {}) }),
    unionBounds: null,
    modifiers: NO_MOD,
  };
}

describe('createRotationAffordance', () => {
  it('exposes a stable id for visibility maps', () => {
    expect(createRotationAffordance().id).toBe('selection.rotation-handle');
  });

  it('produces no regions when no selection', () => {
    const aff = createRotationAffordance();
    const state: ChromeState = {
      selection: [], multiActive: false, boundsOf: () => null, unionBounds: null, modifiers: NO_MOD,
    };
    expect(aff.regions(state)).toEqual([]);
  });

  it('emits one annulus region for a single selection', () => {
    const aff = createRotationAffordance();
    const regions = aff.regions(stateWithSingle());
    expect(regions).toHaveLength(1);
    expect(regions[0]!.shape.kind).toBe('annulus');
    expect(regions[0]!.targetId).toBe('a');
  });

  it('annulus geometry: outer ellipse semi-axes pass through the AABB corners (when natural ≥ minBand)', () => {
    // AABB 100x100, semi-axes = 50·√2 ≈ 70.71. With default bandPx=24 the
    // natural value wins (50·√2 = 70.71 > 50 + 24 = 74? — no, 70.71 < 74,
    // so the band clamp wins). Use a larger AABB to exercise the natural
    // branch.
    const aff = createRotationAffordance({ bandPx: 24 });
    const state: ChromeState = {
      selection: [asNodeId('a')],
      multiActive: false,
      boundsOf: () => ({ x: 0, y: 0, width: 400, height: 400 }),
      unionBounds: null,
      modifiers: NO_MOD,
    };
    const r = aff.regions(state)[0]!;
    const s = r.shape as Extract<typeof r.shape, { kind: 'annulus' }>;
    expect(s.rx).toBeCloseTo(200 * Math.SQRT2, 4);
    expect(s.ry).toBeCloseTo(200 * Math.SQRT2, 4);
    expect(s.cx).toBe(200);
    expect(s.cy).toBe(200);
  });

  it('annulus geometry: outer ellipse clamped to bandPx beyond AABB for thin selections', () => {
    // 20x20 AABB, bandPx=24. Natural = 10·√2 ≈ 14.14. Clamp = 10+24 = 34. Clamp wins.
    // The region declares the natural ellipse plus a screen-space floor; the
    // framework resolves the two together, because only it knows the scale.
    const aff = createRotationAffordance({ bandPx: 24 });
    const state: ChromeState = {
      selection: [asNodeId('a')],
      multiActive: false,
      boundsOf: () => ({ x: 0, y: 0, width: 20, height: 20 }),
      unionBounds: null,
      modifiers: NO_MOD,
    };
    const r = aff.regions(state)[0]!;
    const s = r.shape as Extract<typeof r.shape, { kind: 'annulus' }>;
    expect(s.rx).toBeCloseTo(10 * Math.SQRT2, 4);
    expect(s.minBandPx).toBe(24);
    expect(annulusSemiAxes(s, VIEW)).toEqual({ rx: 34, ry: 34 });
  });

  it('the band holds its screen thickness under zoom', () => {
    // Regression: the clamp used to be applied in `regions()` in world units,
    // so at scale 2 a 24px band became 12 screen px and the ring around a
    // small shape got progressively harder to grab as you zoomed in.
    const aff = createRotationAffordance({ bandPx: 24 });
    const state: ChromeState = {
      selection: [asNodeId('a')],
      multiActive: false,
      boundsOf: () => ({ x: 0, y: 0, width: 20, height: 20 }),
      unionBounds: null,
      modifiers: NO_MOD,
    };
    const s = aff.regions(state)[0]!.shape as Extract<
      ReturnType<typeof aff.regions>[number]['shape'], { kind: 'annulus' }
    >;
    const zoomed = { ...VIEW, scale: { x: 2, y: 2 } };
    // 24 screen px at scale 2 is 12 world units past the 10-unit half-extent.
    expect(annulusSemiAxes(s, zoomed)).toEqual({ rx: 22, ry: 22 });
  });

  it('hitTest miss inside the AABB (the cutout)', () => {
    const aff = createRotationAffordance();
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    // (50, 50) is the AABB center — inside the inner rect, so not hit.
    expect(layer.hitTest(50, 50, stateWithSingle(), VIEW, DIMS)).toBeNull();
  });

  it('hitTest miss outside the outer ellipse', () => {
    const aff = createRotationAffordance({ bandPx: 24 });
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    // Way out at (500, 500) — outside any ellipse.
    expect(layer.hitTest(500, 500, stateWithSingle(), VIEW, DIMS)).toBeNull();
  });

  it('hitTest claims when cursor is in the annulus band', () => {
    const aff = createRotationAffordance({ bandPx: 24 });
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    // AABB (0,0,100,100). Directly above the top-center at (50, -10):
    // outside the rect (y < 0), inside the outer ellipse (rx=74, ry=74,
    // distance from center ≈ 60 < 74).
    const result = layer.hitTest(50, -10, stateWithSingle(), VIEW, DIMS);
    expect(result).not.toBeNull();
    expect(result?.initialScratch as RotationScratch).toMatchObject({ targetId: 'a' });
  });

  it('emits one region for a multi-selection anchored at unionBounds', () => {
    const aff = createRotationAffordance();
    const state: ChromeState = {
      selection: [asNodeId('a'), asNodeId('b')],
      multiActive: true,
      boundsOf: () => null,
      unionBounds: { x: 10, y: 20, width: 80, height: 60 },
      modifiers: NO_MOD,
    };
    const regions = aff.regions(state);
    expect(regions).toHaveLength(1);
    expect(regions[0]!.targetId).toBe(MULTI_RESIZE_TARGET_ID);
    const s = regions[0]!.shape as Extract<typeof regions[0]['shape'], { kind: 'annulus' }>;
    expect(s.cx).toBe(50); // union center x
    expect(s.cy).toBe(50); // union center y
    expect(s.innerX).toBe(10);
    expect(s.innerY).toBe(20);
    expect(s.innerWidth).toBe(80);
    expect(s.innerHeight).toBe(60);
  });

  it('emits no region when canRotate returns false for the single selection', () => {
    const aff = createRotationAffordance();
    const state: ChromeState = {
      selection: [asNodeId('a')],
      multiActive: false,
      boundsOf: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      unionBounds: null,
      modifiers: NO_MOD,
      canRotate: () => false,
    };
    expect(aff.regions(state)).toEqual([]);
  });

  it('emits no region when any multi-selection member cannot rotate', () => {
    const aff = createRotationAffordance();
    const state: ChromeState = {
      selection: [asNodeId('a'), asNodeId('b')],
      multiActive: true,
      boundsOf: () => null,
      unionBounds: { x: 0, y: 0, width: 80, height: 60 },
      modifiers: NO_MOD,
      canRotate: (id) => id !== 'b',
    };
    expect(aff.regions(state)).toEqual([]);
  });

  it('hitTest applies bounds rotation', () => {
    // AABB (0,0,100,100) rotated +π/2 around center (50,50). A point in
    // the annulus band UNROTATED is at (50, -10). Under the rotation,
    // the equivalent WORLD point is at (110, 50): center (50,50) plus
    // the rotated offset of (0, -60).
    const aff = createRotationAffordance({ bandPx: 24 });
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    const state = stateWithSingle(Math.PI / 2);
    expect(layer.hitTest(110, 50, state, VIEW, DIMS)).not.toBeNull();
  });
});

describe('rotation-handle cursor', () => {
  const regionOf = (state: ChromeState, opts = {}) =>
    createRotationAffordance(opts).regions(state)[0];

  it('defaults to the rotate glyph rather than a bare grab', () => {
    expect(regionOf(stateWithSingle())).toMatchObject({
      cursor: { glyph: 'rotate', angle: 0, fallback: 'grab' },
    });
  });

  it('turns the glyph with the target', () => {
    expect(regionOf(stateWithSingle(Math.PI / 2)).cursor).toMatchObject({
      angle: Math.PI / 2,
    });
  });

  it('lets a caller override the whole spec', () => {
    expect(regionOf(stateWithSingle(), { cursor: 'grab' }).cursor).toBe('grab');
  });
});
