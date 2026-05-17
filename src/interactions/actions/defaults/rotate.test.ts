import { describe, it, expect } from 'vitest';
import { rotateAction } from './rotate';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx } from '../invoker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(selectionIds: string[] = ['a']): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => selectionIds },
      scene: {},
    },
  };
}

function getOngoingInvoker(action: typeof rotateAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rotateAction descriptor', () => {
  it('declares id, label, drag gestureBinding, and ongoing timing', () => {
    expect(rotateAction.id).toBe('rotate');
    expect(rotateAction.label).toBe('Rotate');
    expect(rotateAction.gestureBinding).toEqual({ kind: 'drag' });
    expect(rotateAction.invoker?.timing).toBe('ongoing');
  });

  it('requires selection and scene deps', () => {
    expect(rotateAction.requires).toContain('selection');
    expect(rotateAction.requires).toContain('scene');
  });

  it('enabled returns SelectionRequired', () => {
    expect(rotateAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('start returns empty handle (stub — Phase 8+ wires body)', () => {
    const invoker = getOngoingInvoker(rotateAction);
    const handle = invoker.start(makeCtx(), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when selection is empty', () => {
    const invoker = getOngoingInvoker(rotateAction);
    const handle = invoker.start(makeCtx([]), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when deps are absent', () => {
    const invoker = getOngoingInvoker(rotateAction);
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
