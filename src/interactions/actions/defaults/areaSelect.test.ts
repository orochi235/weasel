import { describe, it, expect } from 'vitest';
import { areaSelectAction } from './areaSelect';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx } from '../invoker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(): InvocationCtx {
  return {
    world: { x: 10, y: 20 },
    screen: { x: 10, y: 20 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => [] },
    },
    drag: {
      start: { x: 10, y: 20 },
      current: { x: 50, y: 60 },
      delta: { x: 40, y: 40 },
    },
  };
}

function getOngoingInvoker(action: typeof areaSelectAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('areaSelectAction descriptor', () => {
  it('declares id, label, drag gestureBinding, and ongoing timing', () => {
    expect(areaSelectAction.id).toBe('areaSelect');
    expect(areaSelectAction.label).toBe('Area Select');
    expect(areaSelectAction.gestureBinding).toEqual({ kind: 'drag' });
    expect(areaSelectAction.invoker?.timing).toBe('ongoing');
  });

  it('requires selection dep', () => {
    expect(areaSelectAction.requires).toContain('selection');
  });

  it('enabled returns SelectionRequired (static placeholder)', () => {
    expect(areaSelectAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('start returns empty handle (stub — Phase 8+ wires body)', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
    const handle = invoker.start(makeCtx(), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when deps are absent', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
    const emptyCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(emptyCtx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle with drag context present', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
    const handle = invoker.start(makeCtx(), undefined);
    // Stub ignores drag context; ensures no throw on valid drag input.
    expect(handle).toEqual({});
  });
});
