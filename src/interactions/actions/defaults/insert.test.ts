import { describe, it, expect } from 'vitest';
import { insertAction } from './insert';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx } from '../invoker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(): InvocationCtx {
  return {
    world: { x: 5, y: 10 },
    screen: { x: 5, y: 10 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      activeTool: { id: 'rect' },
    },
    drag: {
      start: { x: 5, y: 10 },
      current: { x: 55, y: 60 },
      delta: { x: 50, y: 50 },
    },
  };
}

function getOngoingInvoker(action: typeof insertAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('insertAction descriptor', () => {
  it('declares id, label, drag gestureBinding, and ongoing timing', () => {
    expect(insertAction.id).toBe('insert');
    expect(insertAction.label).toBe('Insert');
    expect(insertAction.gestureBinding).toEqual({ kind: 'drag' });
    expect(insertAction.invoker?.timing).toBe('ongoing');
  });

  it('requires activeTool dep', () => {
    expect(insertAction.requires).toContain('activeTool');
  });

  it('enabled returns SelectionRequired (static placeholder)', () => {
    expect(insertAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('start returns empty handle (stub — Phase 8+ wires body)', () => {
    const invoker = getOngoingInvoker(insertAction);
    const handle = invoker.start(makeCtx(), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when deps are absent', () => {
    const invoker = getOngoingInvoker(insertAction);
    const emptyCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(emptyCtx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle with drag bounds present', () => {
    const invoker = getOngoingInvoker(insertAction);
    const handle = invoker.start(makeCtx(), undefined);
    // Stub ignores drag/bounds; no throw on valid drag input.
    expect(handle).toEqual({});
  });
});
