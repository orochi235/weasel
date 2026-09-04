import { describe, it, expect, vi } from 'vitest';
import { viewportDragPanAction } from './viewportDragPan';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../depSchema';
import type { InvocationCtx } from '../invoker';
import type { DecayLoopConfig } from 'core/viewport/useDecayLoop';

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

/** A view that also publishes `decay`, recording the config it was handed. */
function makeDecayView(initial?: View) {
  const view = makeView(initial) as ViewApi & { _value: View };
  const calls: DecayLoopConfig[] = [];
  view.decay = (config: DecayLoopConfig) => { calls.push(config); };
  view.stopDecay = () => {};
  return { view, calls };
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


// ---------------------------------------------------------------------------
// Axis locking
// ---------------------------------------------------------------------------

describe('viewportDragPanAction axis locking', () => {
  function startWith(view: ViewApi, params?: Record<string, unknown>) {
    const invoker = getOngoingInvoker(viewportDragPanAction);
    return invoker.start(makeCtx(view), params ? { params } : undefined);
  }

  it("axis 'x' pans x and leaves y at its start value", () => {
    const view = makeView({ x: 100, y: 200, scale: { x: 1, y: 1 } });
    const handle = startWith(view, { axis: 'x' });
    handle.onMove!(makeCtx(view, { delta: { x: 30, y: 50 } }));
    expect(view._value.x).toBe(70);   // 100 - 30
    expect(view._value.y).toBe(200);  // untouched
  });

  it("axis 'y' pans y and leaves x at its start value", () => {
    const view = makeView({ x: 100, y: 200, scale: { x: 1, y: 1 } });
    const handle = startWith(view, { axis: 'y' });
    handle.onMove!(makeCtx(view, { delta: { x: 30, y: 50 } }));
    expect(view._value.x).toBe(100);
    expect(view._value.y).toBe(150);  // 200 - 50
  });

  it("axis 'both' and an absent axis param both pan freely", () => {
    for (const params of [{ axis: 'both' }, undefined]) {
      const view = makeView({ x: 100, y: 200, scale: { x: 1, y: 1 } });
      const handle = startWith(view, params);
      handle.onMove!(makeCtx(view, { delta: { x: 30, y: 50 } }));
      expect(view._value.x).toBe(70);
      expect(view._value.y).toBe(150);
    }
  });

  it('honors a params thunk, the form useHandTool supplies', () => {
    const view = makeView({ x: 100, y: 200, scale: { x: 1, y: 1 } });
    const invoker = getOngoingInvoker(viewportDragPanAction);
    const handle = invoker.start(makeCtx(view), { params: () => ({ axis: 'x' }) });
    handle.onMove!(makeCtx(view, { delta: { x: 30, y: 50 } }));
    expect(view._value.y).toBe(200);
  });

  it('keeps the lock however the pointer wanders on the locked axis', () => {
    const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const handle = startWith(view, { axis: 'x' });
    handle.onMove!(makeCtx(view, { delta: { x: 10, y: 40 } }));
    handle.onMove!(makeCtx(view, { delta: { x: 20, y: -90 } }));
    handle.onMove!(makeCtx(view, { delta: { x: 25, y: 5 } }));
    expect(view._value.x).toBe(-25);
    expect(view._value.y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Inertia
// ---------------------------------------------------------------------------

describe('viewportDragPanAction inertia', () => {
  const invoker = getOngoingInvoker(viewportDragPanAction);

  function fling(
    view: ViewApi,
    params: Record<string, unknown> | undefined,
    reason: 'commit' | 'cancel' = 'commit',
  ) {
    let now = 1000;
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      const handle = invoker.start(makeCtx(view), params ? { params } : undefined);
      for (const step of [10, 20, 30, 40]) {
        now += 16;
        handle.onMove!(makeCtx(view, { delta: { x: step, y: step } }));
      }
      handle.onEnd!(makeCtx(view), reason);
    } finally {
      spy.mockRestore();
    }
  }

  it('starts a decay on commit when inertia is configured', () => {
    const { view, calls } = makeDecayView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    fling(view, { inertia: { friction: 0.9 } });
    expect(calls).toHaveLength(1);
    expect(calls[0].friction).toBe(0.9);
    // Dragging right moves the camera left, so the coast must continue left.
    expect(calls[0].velocity.vx).toBeLessThan(0);
    expect(calls[0].velocity.vy).toBeLessThan(0);
  });

  it('does not coast when the gesture was cancelled', () => {
    const { view, calls } = makeDecayView();
    fling(view, { inertia: { friction: 0.9 } }, 'cancel');
    expect(calls).toHaveLength(0);
  });

  it('does not coast when inertia is absent or explicitly false', () => {
    for (const params of [undefined, { inertia: false }]) {
      const { view, calls } = makeDecayView();
      fling(view, params);
      expect(calls).toHaveLength(0);
    }
  });

  it('does not throw when inertia is asked for but no decay dep is wired', () => {
    const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    expect(() => fling(view, { inertia: { friction: 0.9 } })).not.toThrow();
  });

  it('forwards boundary and bounds to the decay loop', () => {
    const { view, calls } = makeDecayView();
    const bounds = { minX: -50, maxX: 50 };
    fling(view, { inertia: { boundary: 'stop', bounds } });
    expect(calls[0].boundary).toBe('stop');
    expect(calls[0].viewBounds).toBe(bounds);
  });

  it('coast ticks move the view from wherever the drag landed', () => {
    const { view, calls } = makeDecayView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    fling(view, { inertia: {} });
    const landed = view.get().x;
    calls[0].onTick(-7, -3);
    expect(view.get().x).toBe(landed - 7);
  });

  it('scales coast velocity by zoom, matching the drag conversion', () => {
    const one = makeDecayView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    fling(one.view, { inertia: {} });
    const two = makeDecayView({ x: 0, y: 0, scale: { x: 2, y: 2 } });
    fling(two.view, { inertia: {} });
    expect(two.calls[0].velocity.vx).toBeCloseTo(one.calls[0].velocity.vx / 2);
  });

  it('locks coast velocity to the axis the drag was locked to', () => {
    const { view, calls } = makeDecayView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    fling(view, { axis: 'x', inertia: {} });
    expect(calls[0].velocity.vx).toBeLessThan(0);
    // -0 is a fine zero here; Object.is would split it from +0.
    expect(calls[0].velocity.vy).toBeCloseTo(0);
  });
});
