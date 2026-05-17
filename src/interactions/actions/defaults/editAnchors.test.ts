import { describe, it, expect } from 'vitest';
import { editAnchorsAction } from './editAnchors';
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

function getOngoingInvoker(action: typeof editAnchorsAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('editAnchorsAction descriptor', () => {
  it('declares id, label, drag gestureBinding, and ongoing timing', () => {
    expect(editAnchorsAction.id).toBe('editAnchors');
    expect(editAnchorsAction.label).toBe('Edit Anchors');
    expect(editAnchorsAction.gestureBinding).toEqual({ kind: 'drag' });
    expect(editAnchorsAction.invoker?.timing).toBe('ongoing');
  });

  it('requires selection and scene deps', () => {
    expect(editAnchorsAction.requires).toContain('selection');
    expect(editAnchorsAction.requires).toContain('scene');
  });

  it('enabled returns SelectionRequired', () => {
    expect(editAnchorsAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('start returns empty handle (stub — Phase 8+ wires body)', () => {
    const invoker = getOngoingInvoker(editAnchorsAction);
    const handle = invoker.start(makeCtx(), undefined);
    // Stub returns {} — no onMove / onEnd handlers yet.
    expect(handle).toEqual({});
  });

  it('start returns empty handle when selection is empty (stub self-guards trivially)', () => {
    const invoker = getOngoingInvoker(editAnchorsAction);
    const handle = invoker.start(makeCtx([]), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when deps are absent', () => {
    const invoker = getOngoingInvoker(editAnchorsAction);
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
