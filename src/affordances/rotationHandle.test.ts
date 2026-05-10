import { describe, expect, it } from 'vitest';
import { createRotationAffordance } from './rotationHandle';
import type { ChromeState } from 'core/selection/chromeState';
import { asNodeId } from 'core/scene/types';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: 1 };

function stateWithSingle(): ChromeState {
  return {
    selection: [asNodeId('a')],
    multiActive: false,
    boundsOf: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    unionBounds: null,
    modifiers: NO_MOD,
  };
}

describe('createRotationAffordance', () => {
  it('exposes a stable id for visibility maps', () => {
    expect(createRotationAffordance().id).toBe('rotation-handle');
  });

  it('renders nothing when no selection', () => {
    const aff = createRotationAffordance();
    const state: ChromeState = {
      selection: [], multiActive: false, boundsOf: () => null, unionBounds: null, modifiers: NO_MOD,
    };
    expect(aff.render(state, VIEW)).toEqual([]);
  });

  it('renders the leader line + handle when a single selection has bounds', () => {
    const cmds = createRotationAffordance().render(stateWithSingle(), VIEW);
    // At least one drawcommand for the leader and one for the handle.
    expect(cmds.length).toBeGreaterThanOrEqual(2);
  });

  it('hitTest returns null when cursor is far from the handle', () => {
    const aff = createRotationAffordance({ handleHitRadius: 8 });
    expect(aff.hitTest!(0, 0, stateWithSingle(), VIEW)).toBeNull();
  });

  it('hitTest claims when cursor is on the handle', () => {
    const aff = createRotationAffordance({ distance: 24, handleHitRadius: 8 });
    // Bounds (0,0,100,100); top-center (50,0); handle 24 px above → (50, -24).
    const result = aff.hitTest!(50, -24, stateWithSingle(), VIEW);
    expect(result).not.toBeNull();
    expect(result?.initialScratch).toMatchObject({ targetId: 'a' });
  });
});
