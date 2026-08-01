import { describe, expect, it } from 'vitest';
import { createCornerResizeAffordance, type CornerResizeScratch } from './cornerResize';
import { composeAffordanceLayer } from './composeAffordanceLayer';
import type { ChromeState } from 'core/selection/chromeState';
import { asNodeId } from 'core/scene/types';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/select';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 400, height: 400 };

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

  it('produces 4 point regions for a single selection in single-mode', () => {
    const aff = createCornerResizeAffordance();
    const regions = aff.regions(stateWithSingle());
    expect(regions).toHaveLength(4);
    for (const r of regions) {
      expect(r.shape.kind).toBe('point');
      expect(r.targetId).toBe('a');
    }
  });

  it('produces 4 point regions for the union AABB in multi-mode', () => {
    const aff = createCornerResizeAffordance();
    const regions = aff.regions(stateWithMulti());
    expect(regions).toHaveLength(4);
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
