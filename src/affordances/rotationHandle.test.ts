import { describe, expect, it } from 'vitest';
import { createRotationAffordance, type RotationScratch } from './rotationHandle';
import { composeAffordanceLayer } from './composeAffordanceLayer';
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

  it('produces one point region for a single selection', () => {
    const aff = createRotationAffordance();
    const regions = aff.regions(stateWithSingle());
    expect(regions).toHaveLength(1);
    expect(regions[0]!.shape.kind).toBe('point');
    expect(regions[0]!.targetId).toBe('a');
  });

  it('decorate emits no tether by default', () => {
    const aff = createRotationAffordance();
    const cmds = aff.decorate!(stateWithSingle(), VIEW);
    expect(cmds).toEqual([]);
  });

  it('decorate emits the tether line when tether is true', () => {
    const aff = createRotationAffordance({ tether: true });
    const cmds = aff.decorate!(stateWithSingle(), VIEW);
    expect(cmds.length).toBeGreaterThanOrEqual(1);
  });

  it('decorate emits the tether line when a custom stroke is provided', () => {
    const aff = createRotationAffordance({ tether: { paint: { color: '#fff' }, width: 2 } });
    const cmds = aff.decorate!(stateWithSingle(), VIEW);
    expect(cmds.length).toBeGreaterThanOrEqual(1);
  });

  it('layer hitTest returns null when cursor is far from the handle', () => {
    const aff = createRotationAffordance({ handleHitRadius: 8 });
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    expect(layer.hitTest(0, 0, stateWithSingle(), VIEW, DIMS)).toBeNull();
  });

  it('layer hitTest claims when cursor is on the handle (unrotated)', () => {
    const aff = createRotationAffordance({ distance: 24, handleHitRadius: 8 });
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    // Bounds (0,0,100,100); top-center (50,0); handle 24 px above → (50, -24).
    const result = layer.hitTest(50, -24, stateWithSingle(), VIEW, DIMS);
    expect(result).not.toBeNull();
    expect(result?.initialScratch as RotationScratch).toMatchObject({ targetId: 'a' });
  });

  it('produces one region for a multi-selection anchored at unionBounds', () => {
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
    // Handle at union top-center, distance 24 above: (50, -4).
    expect(regions[0]!.shape).toMatchObject({ kind: 'point', x: 50, y: -4 });
  });

  it('layer hitTest applies bounds rotation', () => {
    // Bounds (0,0,100,100) rotated +π/2 around center (50,50). Local handle
    // position (50, -24): dx=0, dy=-74; rotation formula gives world
    // (50 + 0·0 - (-74)·1, 50 + 0·1 + (-74)·0) = (124, 50).
    const aff = createRotationAffordance({ distance: 24, handleHitRadius: 8 });
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    const state = stateWithSingle(Math.PI / 2);
    expect(layer.hitTest(124, 50, state, VIEW, DIMS)).not.toBeNull();
    // Unrotated position misses under rotation.
    expect(layer.hitTest(50, -24, state, VIEW, DIMS)).toBeNull();
  });
});
