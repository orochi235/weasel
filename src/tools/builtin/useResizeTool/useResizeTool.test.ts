import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResizeTool } from './useResizeTool';

const minimalAdapter = {
  getNode: (id: string) => ({ id }),
  getNodes: () => [],
  getPose: (_id: string) => ({ x: 0, y: 0, width: 10, height: 10 }),
  getParent: (_id: string) => null,
  setPose: vi.fn(),
  setParent: vi.fn(),
  applyOps: vi.fn(),
} as any;

describe('useResizeTool overlay.hitTest', () => {
  it('over resize handle returns an AffordanceBinding that drives useResize', () => {
    // Corner-handle hits flow through the tool's overlay.hitTest (the
    // affordance pipeline). The dispatcher walks the active tool's overlay
    // layers and routes the resulting drag channel for the gesture. We invoke
    // the overlay's hitTest directly with the ChromeState shape it expects.
    const { result } = renderHook(() =>
      useResizeTool(minimalAdapter, {
        boundsOf: (id) => (id === 'obj1' ? { x: 0, y: 0, width: 100, height: 100 } : null),
        handleHitRadius: 10,
      }),
    );
    const chromeState = {
      selection: ['obj1'],
      multiActive: false,
      unionBounds: null,
      boundsOf: (id: string) => (id === 'obj1' ? { x: 0, y: 0, width: 100, height: 100 } : null),
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    } as any;
    const view = { x: 0, y: 0, scale: 1 };
    const dims = { width: 200, height: 200 };
    const hit = result.current.overlay!.hitTest!(0, 0, chromeState, view, dims);
    expect(hit).not.toBeNull();
    expect(hit!.initialScratch).toEqual(expect.objectContaining({ targetId: 'obj1' }));
    expect(typeof hit!.drag.onStart).toBe('function');
  });

  it('handleHitRadius is screen-px (scale=2 halves world hit radius)', () => {
    // 100×100 object at (0,0). handleHitRadius=10 screen px → 5 world at
    // scale=2. cornerHandle hit-test uses max-norm; worldX=6 is outside the
    // 5-world half-extent on the X axis (miss). worldX=4 is inside (hit).
    const { result } = renderHook(() =>
      useResizeTool(minimalAdapter, {
        boundsOf: (id) => (id === 'obj1' ? { x: 0, y: 0, width: 100, height: 100 } : null),
        handleHitRadius: 10,
      }),
    );
    const chromeState = {
      selection: ['obj1'],
      multiActive: false,
      unionBounds: null,
      boundsOf: (id: string) => (id === 'obj1' ? { x: 0, y: 0, width: 100, height: 100 } : null),
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    } as any;
    const view = { x: 0, y: 0, scale: 2 };
    const dims = { width: 200, height: 200 };
    expect(result.current.overlay!.hitTest!(6, 0, chromeState, view, dims)).toBeNull();
    expect(result.current.overlay!.hitTest!(4, 0, chromeState, view, dims)).not.toBeNull();
  });
});
