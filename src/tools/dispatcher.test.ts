// src/tools/dispatcher.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createToolsDispatcher, type ToolsDispatcher } from './dispatcher';
import { defineTool } from './defineTool';
import type { AnyTool, ToolCtx } from './types';

function makeCtx(over: Partial<ToolCtx> = {}): ToolCtx {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { get: () => [], set: () => {}, add: () => {}, remove: () => {}, toggle: () => {}, clear: () => {}, applyClick: () => {} } as never,
    adapter: null,
    applyBatch: () => {},
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: undefined,
    ...over,
  };
}

function pointerEvent(type: string, init: Partial<PointerEventInit> = {}): PointerEvent {
  // jsdom doesn't implement PointerEvent; synthesize via Event + assign.
  const ev = new Event(type) as PointerEvent;
  Object.assign(ev, { clientX: 0, clientY: 0, pointerId: 1, ...init });
  return ev;
}

interface SlotsState {
  modifier: AnyTool | null;
  active: AnyTool | null;
  alwaysOn: AnyTool[];
}

function makeDispatcher(slots: SlotsState): ToolsDispatcher {
  return createToolsDispatcher({
    getSlots: () => slots,
    getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
    threshold: 4,
  });
}

describe('dispatcher: slot order', () => {
  it('walks modifier → active → alwaysOn for keyboard events', () => {
    const order: string[] = [];
    const make = (id: string, decision: 'claim' | 'pass') =>
      defineTool({
        id,
        keyboard: { onDown: () => { order.push(id); return decision; } },
      });

    const d = makeDispatcher({
      modifier: make('modA', 'pass'),
      active: make('actA', 'pass'),
      alwaysOn: [make('always1', 'pass'), make('always2', 'claim')],
    });

    d.onKeyDown(new KeyboardEvent('keydown', { key: 'x' }));
    expect(order).toEqual(['modA', 'actA', 'always1', 'always2']);
  });

  it('stops dispatch when a slot claims', () => {
    const order: string[] = [];
    const make = (id: string, decision: 'claim' | 'pass') =>
      defineTool({
        id,
        keyboard: { onDown: () => { order.push(id); return decision; } },
      });

    const d = makeDispatcher({
      modifier: make('modA', 'claim'),
      active: make('actA', 'claim'),
      alwaysOn: [],
    });

    d.onKeyDown(new KeyboardEvent('keydown', { key: 'x' }));
    expect(order).toEqual(['modA']);
  });
});

describe('dispatcher: threshold-gated drag', () => {
  it('routes sub-threshold release to pointer.onClick', () => {
    const onClick = vi.fn(() => 'claim' as const);
    const onDragStart = vi.fn(() => 'claim' as const);
    const tool = defineTool({
      id: 't',
      pointer: { onClick },
      drag: { onStart: onDragStart },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 102, clientY: 101 }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('routes post-threshold movement to drag.onStart/onMove/onEnd', () => {
    const onClick = vi.fn(() => 'claim' as const);
    const onStart = vi.fn(() => 'claim' as const);
    const onMove = vi.fn(() => 'claim' as const);
    const onEnd = vi.fn(() => 'claim' as const);
    const tool = defineTool({
      id: 't',
      pointer: { onClick },
      drag: { onStart, onMove, onEnd },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 110, clientY: 100 })); // crosses threshold
    d.onPointerMove(pointerEvent('pointermove', { clientX: 120, clientY: 100 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 120, clientY: 100 }));

    expect(onStart).toHaveBeenCalledOnce();
    expect(onMove).toHaveBeenCalledOnce(); // the second move (the threshold-crossing one is consumed by onStart)
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('pointer.onDown is a classification pass — fires before threshold and the drag pipeline still runs', () => {
    // pointer.onDown claiming captures scratch (for sub-gesture routing like useSelectTool)
    // but does NOT suppress drag.onStart. The gesture enters pending phase and
    // promotes to drag normally when the threshold is crossed.
    const onDown = vi.fn(() => 'claim' as const);
    const onClick = vi.fn(() => 'claim' as const);
    const onStart = vi.fn(() => 'claim' as const);
    const tool = defineTool({
      id: 't',
      pointer: { onDown, onClick },
      drag: { onStart },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown'));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 })); // crosses threshold
    d.onPointerUp(pointerEvent('pointerup'));

    expect(onDown).toHaveBeenCalledOnce();
    // drag.onStart fires after threshold — pointer.onDown is classification, not an escape hatch.
    expect(onStart).toHaveBeenCalledOnce();
    // pointer.onClick does NOT fire (gesture was promoted to drag).
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('dispatcher: scratch lifecycle', () => {
  it('initializes scratch on gesture start and persists across moves', () => {
    const scratchSeen: unknown[] = [];
    const tool = defineTool({
      id: 't',
      initScratch: () => ({ count: 0 }),
      drag: {
        onStart: (_e, ctx) => { ctx.scratch.count = 1; scratchSeen.push({ ...ctx.scratch }); return 'claim'; },
        onMove:  (_e, ctx) => { ctx.scratch.count++; scratchSeen.push({ ...ctx.scratch }); return 'claim'; },
        onEnd:   (_e, ctx) => { scratchSeen.push({ ...ctx.scratch }); return 'claim'; },
      },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown'));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 60, clientY: 50 }));
    d.onPointerUp(pointerEvent('pointerup'));

    expect(scratchSeen).toEqual([{ count: 1 }, { count: 2 }, { count: 2 }]);
  });

  it('replaces scratch on the next gesture', () => {
    const scratches: number[] = [];
    let i = 0;
    const tool = defineTool({
      id: 't',
      initScratch: () => ({ id: ++i }),
      drag: {
        onStart: (_e, ctx) => { scratches.push(ctx.scratch.id); return 'claim'; },
      },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown'));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    d.onPointerUp(pointerEvent('pointerup'));

    d.onPointerDown(pointerEvent('pointerdown'));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    d.onPointerUp(pointerEvent('pointerup'));

    expect(scratches).toEqual([1, 2]);
  });
});

describe('dispatcher: cancelGesture', () => {
  it('invokes drag.onCancel on the in-flight tool, discards scratch', () => {
    const onCancel = vi.fn();
    const tool = defineTool({
      id: 't',
      initScratch: () => ({}),
      drag: {
        onStart: () => 'claim',
        onCancel,
      },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown'));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    d.cancelGesture();

    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('dispatcher: ctx overrides', () => {
  it('passes pointer event modifiers + clientX/Y to getCtx', () => {
    const calls: Array<{ clientX?: number; clientY?: number; modifiers?: Record<string, boolean> }> = [];
    const tool = defineTool({
      id: 't',
      drag: { onStart: () => 'pass', onMove: () => 'pass', onEnd: () => 'pass' },
    });
    const d = createToolsDispatcher({
      getSlots: () => ({ modifier: null, active: tool, alwaysOn: [] }),
      getCtx: (overrides) => {
        calls.push({ ...overrides });
        return makeCtx();
      },
    });

    d.onPointerDown(pointerEvent('pointerdown', {
      clientX: 5, clientY: 7, altKey: true, shiftKey: true,
    } as PointerEventInit));

    expect(calls.at(-1)).toEqual({
      clientX: 5,
      clientY: 7,
      modifiers: { alt: true, shift: true, meta: false, ctrl: false },
    });
  });

  it('passes keyboard modifiers to getCtx', () => {
    const calls: Array<{ modifiers?: Record<string, boolean> }> = [];
    const tool = defineTool({
      id: 't',
      keyboard: { onDown: () => 'pass' },
    });
    const d = createToolsDispatcher({
      getSlots: () => ({ modifier: null, active: tool, alwaysOn: [] }),
      getCtx: (overrides) => {
        calls.push({ ...overrides });
        return makeCtx();
      },
    });

    d.onKeyDown(new KeyboardEvent('keydown', { key: 'x', metaKey: true, ctrlKey: true }));

    expect(calls.at(-1)?.modifiers).toEqual({
      alt: false, shift: false, meta: true, ctrl: true,
    });
  });
});

describe('dispatcher: dblTap', () => {
  // Drive the dispatcher's internal clock so tests don't rely on real timers.
  function nowSource() {
    let t = 0;
    return {
      now: () => t,
      advance: (ms: number) => { t += ms; },
    };
  }

  function makeDblDispatcher(slots: SlotsState, clock: { now: () => number }, opts?: { windowMs?: number; maxDistance?: number }) {
    return createToolsDispatcher({
      getSlots: () => slots,
      getCtx: () => makeCtx(),
      threshold: 4,
      now: clock.now,
      dblTap: opts,
    });
  }

  it('fires dblTap.onTap on the second sub-threshold release within the window', () => {
    const onTap = vi.fn(() => 'claim' as const);
    const onClick = vi.fn(() => 'claim' as const);
    const tool = defineTool({
      id: 't',
      pointer: { onClick },
      dblTap: { onTap },
    });
    const clock = nowSource();
    const d = makeDblDispatcher({ modifier: null, active: tool, alwaysOn: [] }, clock);

    // First tap.
    d.onPointerDown(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 101, clientY: 100 }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();

    clock.advance(150);

    // Second tap, near the first.
    d.onPointerDown(pointerEvent('pointerdown', { clientX: 102, clientY: 101 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 102, clientY: 102 }));

    expect(onTap).toHaveBeenCalledTimes(1);
    // Second click is suppressed because dblTap.onTap claimed.
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire dblTap when the gap exceeds windowMs', () => {
    const onTap = vi.fn(() => 'claim' as const);
    const tool = defineTool({ id: 't', pointer: { onClick: () => 'claim' }, dblTap: { onTap } });
    const clock = nowSource();
    const d = makeDblDispatcher({ modifier: null, active: tool, alwaysOn: [] }, clock, { windowMs: 300 });

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 100, clientY: 100 }));

    clock.advance(500);

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 100, clientY: 100 }));

    expect(onTap).not.toHaveBeenCalled();
  });

  it('does not fire dblTap when the second tap is too far from the first', () => {
    const onTap = vi.fn(() => 'claim' as const);
    const tool = defineTool({ id: 't', pointer: { onClick: () => 'claim' }, dblTap: { onTap } });
    const clock = nowSource();
    const d = makeDblDispatcher({ modifier: null, active: tool, alwaysOn: [] }, clock, { maxDistance: 8 });

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 100, clientY: 100 }));

    clock.advance(100);

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 200, clientY: 200 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 200, clientY: 200 }));

    expect(onTap).not.toHaveBeenCalled();
  });

  it('does not fire dblTap if the second gesture promotes to a drag', () => {
    const onTap = vi.fn(() => 'claim' as const);
    const onStart = vi.fn(() => 'claim' as const);
    const tool = defineTool({
      id: 't',
      pointer: { onClick: () => 'claim' },
      drag: { onStart, onMove: () => 'claim', onEnd: () => 'claim' },
      dblTap: { onTap },
    });
    const clock = nowSource();
    const d = makeDblDispatcher({ modifier: null, active: tool, alwaysOn: [] }, clock);

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 100, clientY: 100 }));

    clock.advance(100);

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 120, clientY: 100 })); // crosses threshold
    d.onPointerUp(pointerEvent('pointerup', { clientX: 120, clientY: 100 }));

    expect(onStart).toHaveBeenCalledOnce();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('walks slot order for dblTap and stops at the first claim', () => {
    const order: string[] = [];
    const make = (id: string, decision: 'claim' | 'pass') =>
      defineTool({
        id,
        pointer: { onClick: () => 'claim' },
        dblTap: { onTap: () => { order.push(id); return decision; } },
      });

    const clock = nowSource();
    const d = makeDblDispatcher(
      { modifier: make('mod', 'pass'), active: make('act', 'claim'), alwaysOn: [make('always', 'claim')] },
      clock,
    );

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 0, clientY: 0 }));
    clock.advance(100);
    d.onPointerDown(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 0, clientY: 0 }));

    expect(order).toEqual(['mod', 'act']);
  });

  it('still calls pointer.onClick when no tool claims dblTap', () => {
    const onTap = vi.fn(() => 'pass' as const);
    const onClick = vi.fn(() => 'claim' as const);
    const tool = defineTool({
      id: 't',
      pointer: { onClick },
      dblTap: { onTap },
    });
    const clock = nowSource();
    const d = makeDblDispatcher({ modifier: null, active: tool, alwaysOn: [] }, clock);

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 0, clientY: 0 }));
    clock.advance(100);
    d.onPointerDown(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 0, clientY: 0 }));

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(2); // both taps' clicks fire
  });

  it('does not chain a third tap into another dblTap (resets after firing)', () => {
    const onTap = vi.fn(() => 'claim' as const);
    const tool = defineTool({ id: 't', pointer: { onClick: () => 'claim' }, dblTap: { onTap } });
    const clock = nowSource();
    const d = makeDblDispatcher({ modifier: null, active: tool, alwaysOn: [] }, clock);

    for (let i = 0; i < 3; i++) {
      d.onPointerDown(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
      d.onPointerUp(pointerEvent('pointerup', { clientX: 0, clientY: 0 }));
      clock.advance(100);
    }

    // Tap1 → Tap2 fires dblTap. Tap3 must not trigger another (it would
    // require a fresh first-tap to anchor against).
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});

describe('dispatcher: onGestureChange', () => {
  it('fires on pending start, drag promotion, and end', () => {
    const onGestureChange = vi.fn();
    const tool = defineTool({
      id: 't',
      drag: { onStart: () => 'pass', onMove: () => 'pass', onEnd: () => 'pass' },
    });
    const d = createToolsDispatcher({
      getSlots: () => ({ modifier: null, active: tool, alwaysOn: [] }),
      getCtx: () => makeCtx(),
      onGestureChange,
    });

    d.onPointerDown(pointerEvent('pointerdown'));
    expect(onGestureChange).toHaveBeenCalledTimes(1); // pending start

    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    expect(onGestureChange).toHaveBeenCalledTimes(2); // pending → drag

    d.onPointerUp(pointerEvent('pointerup', { clientX: 50, clientY: 50 }));
    expect(onGestureChange).toHaveBeenCalledTimes(3); // end
  });

  it('fires on cancelGesture mid-drag', () => {
    const onGestureChange = vi.fn();
    const tool = defineTool({
      id: 't',
      drag: { onStart: () => 'pass', onCancel: () => {} },
    });
    const d = createToolsDispatcher({
      getSlots: () => ({ modifier: null, active: tool, alwaysOn: [] }),
      getCtx: () => makeCtx(),
      onGestureChange,
    });

    d.onPointerDown(pointerEvent('pointerdown'));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    onGestureChange.mockClear();

    d.cancelGesture();
    expect(onGestureChange).toHaveBeenCalledTimes(1);
  });
});
