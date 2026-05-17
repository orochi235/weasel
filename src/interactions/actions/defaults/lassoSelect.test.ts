import { describe, it, expect } from 'vitest';
import { lassoSelectAction } from './lassoSelect';
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
      selection: { get: () => [] },
      scene: {},
    },
  };
}

function getOngoingInvoker(action: typeof lassoSelectAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('lassoSelectAction descriptor', () => {
  it('declares id, label, drag gestureBinding, and ongoing timing', () => {
    expect(lassoSelectAction.id).toBe('lassoSelect');
    expect(lassoSelectAction.label).toBe('Lasso Select');
    expect(lassoSelectAction.gestureBinding).toEqual({ kind: 'drag' });
    expect(lassoSelectAction.invoker?.timing).toBe('ongoing');
  });

  it('requires selection and scene deps', () => {
    expect(lassoSelectAction.requires).toContain('selection');
    expect(lassoSelectAction.requires).toContain('scene');
  });

  it('enabled returns true (always enabled)', () => {
    expect(lassoSelectAction.enabled!()).toBe(true);
  });

  it('start returns empty handle (stub — Phase 8+ wires body)', () => {
    const invoker = getOngoingInvoker(lassoSelectAction);
    const handle = invoker.start(makeCtx(), undefined);
    // Stub returns {} — no onMove / onEnd handlers yet.
    expect(handle).toEqual({});
  });

  it('start returns empty handle when deps are absent', () => {
    const invoker = getOngoingInvoker(lassoSelectAction);
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
