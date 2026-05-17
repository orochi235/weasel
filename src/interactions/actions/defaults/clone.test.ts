import { describe, it, expect } from 'vitest';
import { cloneAction } from './clone';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx } from '../invoker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(selectionIds: string[] = ['a', 'b']): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: true, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => selectionIds },
      scene: {},
    },
    drag: {
      start: { x: 0, y: 0 },
      current: { x: 20, y: 30 },
      delta: { x: 20, y: 30 },
    },
  };
}

function getOngoingInvoker(action: typeof cloneAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cloneAction descriptor', () => {
  it('declares id, label, drag gestureBinding, and ongoing timing', () => {
    expect(cloneAction.id).toBe('clone');
    expect(cloneAction.label).toBe('Clone');
    expect(cloneAction.gestureBinding).toEqual({ kind: 'drag' });
    expect(cloneAction.invoker?.timing).toBe('ongoing');
  });

  it('requires selection and scene deps', () => {
    expect(cloneAction.requires).toContain('selection');
    expect(cloneAction.requires).toContain('scene');
  });

  it('enabled returns SelectionRequired', () => {
    expect(cloneAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('start returns empty handle (stub — Phase 8+ wires body)', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const handle = invoker.start(makeCtx(), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when selection is empty', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const handle = invoker.start(makeCtx([]), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when deps are absent', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const emptyCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: true, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(emptyCtx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle with alt modifier present (clone-activating mods)', () => {
    const invoker = getOngoingInvoker(cloneAction);
    // Alt is the conventional clone-activating modifier; stub ignores it.
    const handle = invoker.start(makeCtx(['x', 'y', 'z']), undefined);
    expect(handle).toEqual({});
  });
});
