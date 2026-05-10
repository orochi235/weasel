import { describe, expect, it } from 'vitest';
import { createCornerResizeAffordance } from './cornerResize';
import type { ChromeState } from '../core/selection/chromeState';
import { asNodeId } from '../core/scene/types';
import { MULTI_RESIZE_TARGET_ID } from '../tools/builtin/useSelectTool';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: 1 };

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
    expect(aff.id).toBe('corner-resize');
  });

  it('renders nothing when no selection', () => {
    const aff = createCornerResizeAffordance();
    const state: ChromeState = {
      selection: [],
      multiActive: false,
      boundsOf: () => null,
      unionBounds: null,
      modifiers: NO_MOD,
    };
    expect(aff.render(state, VIEW)).toEqual([]);
  });

  it('renders 4 corner handles for a single selection in single-mode', () => {
    const aff = createCornerResizeAffordance();
    const cmds = aff.render(stateWithSingle(), VIEW);
    // Each handle is at least one path command (rect for the handle itself).
    expect(cmds.length).toBeGreaterThanOrEqual(4);
  });

  it('renders 4 corner handles for the union AABB in multi-mode', () => {
    const aff = createCornerResizeAffordance();
    const cmds = aff.render(stateWithMulti(), VIEW);
    expect(cmds.length).toBeGreaterThanOrEqual(4);
  });

  it('hitTest returns null when cursor is far from any handle', () => {
    const aff = createCornerResizeAffordance();
    const result = aff.hitTest!(50, 50, stateWithSingle(), VIEW);
    expect(result).toBeNull();
  });

  it('hitTest claims when cursor is on a corner handle', () => {
    const aff = createCornerResizeAffordance({ handleHitRadius: 8 });
    // Selection at (100, 100, 50, 40). Top-left corner is (100, 100); within
    // 8 world-px hit radius.
    const result = aff.hitTest!(100, 100, stateWithSingle(), VIEW);
    expect(result).not.toBeNull();
    expect(result?.drag).toBeDefined();
  });

  it('hitTest initialScratch identifies the picked anchor + target', () => {
    const aff = createCornerResizeAffordance({ handleHitRadius: 8 });
    // Bottom-right corner of (100, 100, 50, 40) is (150, 140). Anchor pins
    // the opposite corner: { x: 'min', y: 'min' }.
    const result = aff.hitTest!(150, 140, stateWithSingle(), VIEW);
    expect(result?.initialScratch).toEqual({
      anchor: { x: 'min', y: 'min' },
      targetId: 'a',
    });
  });

  it('hitTest in multi-mode targets the synthetic union (not individual members)', () => {
    const aff = createCornerResizeAffordance({ handleHitRadius: 8 });
    // Union bounds are (0, 0, 150, 150). Top-left is (0, 0). Anchor pins BR.
    const result = aff.hitTest!(0, 0, stateWithMulti(), VIEW);
    expect(result?.initialScratch).toEqual({
      anchor: { x: 'max', y: 'max' },
      targetId: MULTI_RESIZE_TARGET_ID,
    });
  });
});
