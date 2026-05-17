import { describe, it, expect } from 'vitest';
import { editAnchorsAction } from './editAnchors';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, AffordanceHit } from '../invoker';
import type { EditAnchorsDep } from '../depSchema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(
  dep?: EditAnchorsDep,
  affordance?: AffordanceHit,
): InvocationCtx {
  return {
    world: { x: 5, y: 5 },
    screen: { x: 5, y: 5 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: dep ? { selection: ['node-a'], editAnchors: dep } : { selection: ['node-a'] },
    drag: {
      start: { x: 5, y: 5 },
      current: { x: 5, y: 5 },
      delta: { x: 0, y: 0 },
      ...(affordance ? { affordance } : {}),
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

  it('requires selection dep', () => {
    expect(editAnchorsAction.requires).toContain('selection');
  });

  it('requires editAnchors dep (Phase 14b)', () => {
    expect(editAnchorsAction.requires).toContain('editAnchors');
  });

  it('enabled returns SelectionRequired', () => {
    expect(editAnchorsAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('start returns empty handle when editAnchors dep is absent', () => {
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

  it('start returns empty handle when no affordance is hit (open canvas drag)', () => {
    const invoker = getOngoingInvoker(editAnchorsAction);
    const dep: EditAnchorsDep = {
      editingId: 'node-a',
      getPose: () => ({ kind: 'polygon', coords: [0, 0, 10, 0, 10, 10] }),
      applyOps: () => {},
    };
    // No affordance in drag → should return {}
    const handle = invoker.start(makeCtx(dep, undefined), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when affordance is non-anchor (e.g. resize handle)', () => {
    const invoker = getOngoingInvoker(editAnchorsAction);
    const dep: EditAnchorsDep = {
      editingId: 'node-a',
      getPose: () => ({ kind: 'polygon', coords: [0, 0, 10, 0, 10, 10] }),
      applyOps: () => {},
    };
    const resizeAffordance: AffordanceHit = { kind: 'handle:bottom-right' };
    const handle = invoker.start(makeCtx(dep, resizeAffordance), undefined);
    expect(handle).toEqual({});
  });

  // PARTIAL status: anchor affordance hit path requires consumer to wire
  // affordance classifier with anchor:N kind. The following tests verify
  // the graceful bail behavior above — the full happy-path test is deferred
  // until Phase 14c wires buildAffordanceAt with anchor hit classification.
  it('start returns empty handle when deps are fully absent', () => {
    const invoker = getOngoingInvoker(editAnchorsAction);
    const handle = invoker.start({
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    }, undefined);
    expect(handle).toEqual({});
  });
});
