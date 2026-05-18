import { describe, it, expect, vi } from 'vitest';
import { viewportDragPanAction } from './viewportDragPan';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../depSchema';
import type { InvocationCtx } from '../invoker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeView(initial: View = { x: 0, y: 0, scale: { x: 1, y: 1 } }): ViewApi & { _value: View } {
  let v = initial;
  return {
    _value: initial,
    get() { return v; },
    set(next) { v = next; (this as unknown as { _value: View })._value = next; },
  };
}

function makeCtx(view: ViewApi, drag?: { delta: { x: number; y: number } }): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { view },
    drag: drag
      ? { start: { x: 0, y: 0 }, current: { x: drag.delta.x, y: drag.delta.y }, delta: drag.delta }
      : { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 } },
  };
}

function getOngoingInvoker(action: typeof viewportDragPanAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Descriptor shape
// ---------------------------------------------------------------------------

describe('viewportDragPanAction descriptor', () => {
  it('declares id, label, drag defaultBinding, and ongoing timing', () => {
    expect(viewportDragPanAction.id).toBe('viewport.dragPan');
    expect(viewportDragPanAction.label).toBe('Drag to pan viewport');
    expect(viewportDragPanAction.defaultBinding).toEqual({ kind: 'drag' });
    expect(viewportDragPanAction.invoker?.timing).toBe('ongoing');
  });

  it('requires view dep', () => {
    expect(viewportDragPanAction.requires).toContain('view');
  });

  it('enabled returns true (always enabled)', () => {
    expect(viewportDragPanAction.enabled!()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invoker behaviour
// ---------------------------------------------------------------------------

describe('viewportDragPanAction invoker', () => {
  it('is a no-op on start (no view mutation)', () => {
    const view = makeView({ x: 10, y: 20, scale: { x: 1, y: 1 } });
    const invoker = getOngoingInvoker(viewportDragPanAction);
    const ctx = makeCtx(view);
    invoker.start(ctx);
    expect(view._value.x).toBe(10);
    expect(view._value.y).toBe(20);
  });

  it('onMove pans by screen delta scaled by zoom (at scale 1x)', () => {
    const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const invoker = getOngoingInvoker(viewportDragPanAction);
    const startCtx = makeCtx(view);
    const handle = invoker.start(startCtx);

    handle.onMove!(makeCtx(view, { delta: { x: 100, y: 100 } }));
    // new view.x = 0 - 100/1 = -100, new view.y = 0 - 100/1 = -100
    expect(view._value.x).toBe(-100);
    expect(view._value.y).toBe(-100);
  });

  it('onMove scales delta inversely to zoom (at scale 2x)', () => {
    const view = makeView({ x: 0, y: 0, scale: { x: 2, y: 2 } });
    const invoker = getOngoingInvoker(viewportDragPanAction);
    const startCtx = makeCtx(view);
    const handle = invoker.start(startCtx);

    handle.onMove!(makeCtx(view, { delta: { x: 100, y: 100 } }));
    // new view.x = 0 - 100/2 = -50, new view.y = 0 - 100/2 = -50
    expect(view._value.x).toBe(-50);
    expect(view._value.y).toBe(-50);
  });

  it('onMove scales delta with 0.5x zoom', () => {
    const view = makeView({ x: 0, y: 0, scale: { x: 0.5, y: 0.5 } });
    const invoker = getOngoingInvoker(viewportDragPanAction);
    const startCtx = makeCtx(view);
    const handle = invoker.start(startCtx);

    handle.onMove!(makeCtx(view, { delta: { x: 100, y: 100 } }));
    // new view.x = 0 - 100/0.5 = -200, new view.y = 0 - 100/0.5 = -200
    expect(view._value.x).toBe(-200);
    expect(view._value.y).toBe(-200);
  });

  it('onMove uses startView, not current view (absolute pan, not incremental)', () => {
    const view = makeView({ x: 100, y: 200, scale: { x: 1, y: 1 } });
    const invoker = getOngoingInvoker(viewportDragPanAction);
    const startCtx = makeCtx(view);
    const handle = invoker.start(startCtx);

    handle.onMove!(makeCtx(view, { delta: { x: 10, y: 20 } }));
    expect(view._value.x).toBe(90);  // 100 - 10/1
    expect(view._value.y).toBe(180); // 200 - 20/1

    // Second move: still relative to startView (not current)
    handle.onMove!(makeCtx(view, { delta: { x: 30, y: 50 } }));
    expect(view._value.x).toBe(70);  // 100 - 30/1
    expect(view._value.y).toBe(150); // 200 - 50/1
  });

  it('preserves scale in updated view', () => {
    const scale = { x: 2, y: 3 };
    const view = makeView({ x: 0, y: 0, scale });
    const invoker = getOngoingInvoker(viewportDragPanAction);
    const handle = invoker.start(makeCtx(view));
    handle.onMove!(makeCtx(view, { delta: { x: 20, y: 40 } }));
    expect(view._value.scale).toEqual(scale);
  });

  it('is a no-op when onMove is called without drag data', () => {
    const view = makeView({ x: 5, y: 5, scale: { x: 1, y: 1 } });
    const invoker = getOngoingInvoker(viewportDragPanAction);
    const handle = invoker.start(makeCtx(view));
    // Pass a ctx without drag
    const noDragCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { view },
    };
    handle.onMove!(noDragCtx);
    expect(view._value.x).toBe(5);
    expect(view._value.y).toBe(5);
  });

  it('onEnd does not throw and makes no scene mutations', () => {
    const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const invoker = getOngoingInvoker(viewportDragPanAction);
    const handle = invoker.start(makeCtx(view));
    handle.onMove!(makeCtx(view, { delta: { x: 10, y: 10 } }));
    const viewAfterMove = { ...view._value };
    expect(() => handle.onEnd!(makeCtx(view), 'commit')).not.toThrow();
    expect(view._value).toEqual(viewAfterMove); // onEnd does not change view
  });

  it('is a no-op when view dep is absent', () => {
    const invoker = getOngoingInvoker(viewportDragPanAction);
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
      drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 } },
    };
    const mockSet = vi.fn();
    // Should not throw; nothing happens.
    expect(() => {
      const handle = invoker.start(ctx);
      handle.onMove?.(ctx);
    }).not.toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });
});
