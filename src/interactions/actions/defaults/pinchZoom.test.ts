import { describe, it, expect } from 'vitest';
import { pinchZoomAction } from './pinchZoom';
import type { InvocationCtx } from '../invoker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      view: { x: 0, y: 0, scale: 1 },
    },
  };
}

function getOngoingInvoker(action: typeof pinchZoomAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pinchZoomAction descriptor', () => {
  it('declares id, label, multiTouch gestureBinding, and ongoing timing', () => {
    expect(pinchZoomAction.id).toBe('viewport.pinchZoom');
    expect(pinchZoomAction.label).toBe('Pinch Zoom');
    expect(pinchZoomAction.gestureBinding).toEqual({ kind: 'multiTouch', fingers: 2 });
    expect(pinchZoomAction.invoker?.timing).toBe('ongoing');
  });

  it('requires view dep', () => {
    expect(pinchZoomAction.requires).toContain('view');
  });

  it('enabled returns true (always enabled)', () => {
    expect(pinchZoomAction.enabled!()).toBe(true);
  });

  it('start returns empty handle (stub — Phase 8+ wires body)', () => {
    const invoker = getOngoingInvoker(pinchZoomAction);
    const handle = invoker.start(makeCtx(), undefined);
    // Stub returns {} — no onMove / onEnd handlers yet.
    expect(handle).toEqual({});
  });

  it('start returns empty handle when deps are absent', () => {
    const invoker = getOngoingInvoker(pinchZoomAction);
    const emptyCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(emptyCtx, undefined);
    expect(handle).toEqual({});
  });
});
