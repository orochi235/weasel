import { describe, it, expect } from 'vitest';
import { resizeAction } from './resize';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx } from '../invoker';
import type { NodeId } from 'core/scene/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStubScene(initial: Record<string, { pose: unknown }> = {}) {
  const poses = new Map<string, unknown>(
    Object.entries(initial).map(([id, { pose }]) => [id, pose]),
  );
  return {
    poses,
    get(id: NodeId) {
      if (!poses.has(id)) return undefined;
      return { pose: poses.get(id), kind: 'leaf' as const, layer: 'main', data: {}, parent: null };
    },
    setPose(id: NodeId, pose: unknown) { poses.set(id, pose); },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    batch<T>(_label: string, fn: () => T): T { return fn(); },
  };
}

function makeCtx(selectionIds: string[] = ['a'], sceneNodes: Record<string, { pose: unknown }> = {}): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => selectionIds as NodeId[] },
      scene: makeStubScene(sceneNodes),
    },
    drag: {
      start: { x: 0, y: 0 },
      current: { x: 20, y: 10 },
      delta: { x: 20, y: 10 },
    },
  };
}

function getOngoingInvoker(action: typeof resizeAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resizeAction descriptor', () => {
  it('declares id, label, drag gestureBinding, and ongoing timing', () => {
    expect(resizeAction.id).toBe('resize');
    expect(resizeAction.label).toBe('Resize');
    expect(resizeAction.gestureBinding).toEqual({ kind: 'drag' });
    expect(resizeAction.invoker?.timing).toBe('ongoing');
  });

  it('requires selection and scene deps', () => {
    expect(resizeAction.requires).toContain('selection');
    expect(resizeAction.requires).toContain('scene');
  });

  it('enabled returns SelectionRequired', () => {
    expect(resizeAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });

  // --- Guard behavior (PARTIAL phase) ---

  it('start returns empty handle when selection is empty (guard)', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const handle = invoker.start(makeCtx([]), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when deps are absent (guard)', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const emptyCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(emptyCtx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when selection dep is missing (guard)', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { scene: makeStubScene({ a: { pose: { x: 0, y: 0, width: 10, height: 10 } } }) },
    };
    const handle = invoker.start(ctx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle even with valid selection+scene (no anchor context — PARTIAL)', () => {
    // Phase 11 PARTIAL: the resize body is deferred because InvocationCtx does
    // not carry a ResizeAnchor. This test documents the known limitation:
    // the handle is always {} regardless of selection state until Phase 12
    // adds InvocationCtx.resizeAnchor.
    const invoker = getOngoingInvoker(resizeAction);
    const handle = invoker.start(
      makeCtx(['a'], { a: { pose: { x: 0, y: 0, width: 100, height: 100 } } }),
      undefined,
    );
    // PARTIAL: returns {} because no anchor classification is available.
    expect(handle).toEqual({});
  });
});
