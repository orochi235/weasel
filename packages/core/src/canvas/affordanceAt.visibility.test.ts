import { describe, expect, it, vi } from 'vitest';
import { buildAffordanceAt } from './affordanceAt';
import type { ChromeState } from 'core/selection/chromeState';
import type { NodeId } from 'core/scene/types';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function makeState(opts: {
  selection?: string[];
  bounds?: { x: number; y: number; width: number; height: number; rotation?: number };
} = {}): ChromeState {
  const selection = (opts.selection ?? ['n1']) as unknown as readonly NodeId[];
  const bounds = opts.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  return {
    selection,
    multiActive: selection.length > 1,
    boundsOf: (id: string) => (id === selection[0] ? bounds : null),
    unionBounds: null,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  };
}

describe('buildAffordanceAt visibility gating', () => {
  it('returns a resize-handle hit when selection.resize-handles is visible', () => {
    const fn = buildAffordanceAt({
      getChromeState: () => makeState(),
      getView: () => VIEW,
      getIsVisible: () => () => true,
    });
    // The top-left corner of bounds 0,0,100x100 is exactly (0, 0).
    const hit = fn({ x: 0, y: 0 });
    expect(hit?.kind).toBe('handle:top-left');
  });

  it('returns null on a corner when selection.resize-handles is NOT visible', () => {
    const isVisible = vi.fn((id: string) => id !== 'selection.resize-handles');
    const fn = buildAffordanceAt({
      getChromeState: () => makeState(),
      getView: () => VIEW,
      getIsVisible: () => isVisible,
    });
    // The rotate ring is still live and (0,0) is a corner of the AABB, which
    // the ring's inner cutout excludes — so nothing claims the point.
    const hit = fn({ x: 0, y: 0 });
    expect(hit).toBeNull();
  });

  it('returns null on the rotate-handle ring when selection.rotation-handle is NOT visible', () => {
    // Rotate ring sits in the band just outside the AABB; (50, -24) sits above
    // the top edge inside the rotation band but outside the AABB.
    const isVisible = vi.fn((id: string) => id !== 'selection.rotation-handle');
    const fn = buildAffordanceAt({
      getChromeState: () => makeState(),
      getView: () => VIEW,
      getIsVisible: () => isVisible,
    });
    const hit = fn({ x: 50, y: -24 });
    expect(hit).toBeNull();
  });

  it('does not test anchors when path-edit.anchors is NOT visible', () => {
    const anchorStateThunk = vi.fn(() => ({
      editingId: 'n1',
      getPose: () => ({
        kind: 'polygon' as const,
        commands: new Uint8Array([0]),
        coords: new Float32Array([0, 0]),
      }),
    }));
    const isVisible = vi.fn((id: string) => id !== 'path-edit.anchors');
    const fn = buildAffordanceAt({
      // Bounds far from the click point so corner/rotate gates don't match.
      getChromeState: () => makeState({ bounds: { x: 1000, y: 1000, width: 10, height: 10 } }),
      getView: () => VIEW,
      getAnchorState: anchorStateThunk,
      getIsVisible: () => isVisible,
    });
    const hit = fn({ x: 0, y: 0 });
    expect(hit).toBeNull();
    // The anchor-state thunk should NOT have been called: the gate fires first.
    expect(anchorStateThunk).not.toHaveBeenCalled();
  });

  it('omitting getIsVisible defaults to always-visible (backward-compat)', () => {
    const fn = buildAffordanceAt({
      getChromeState: () => makeState(),
      getView: () => VIEW,
    });
    const hit = fn({ x: 0, y: 0 });
    expect(hit?.kind).toBe('handle:top-left');
  });
});
