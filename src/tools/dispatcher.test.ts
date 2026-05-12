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
    applyOps: () => {},
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
  hotkey: AnyTool | null;
  active: AnyTool | null;
  ambient: AnyTool[];
}

function makeDispatcher(slots: SlotsState): ToolsDispatcher {
  return createToolsDispatcher({
    getSlots: () => slots,
    getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
    threshold: 4,
  });
}

describe('dispatcher: slot order', () => {
  it('walks modifier → active → ambient for keyboard events', () => {
    const order: string[] = [];
    const make = (id: string, decision: 'claim' | 'pass') =>
      defineTool({
        id,
        keyboard: { onDown: () => { order.push(id); return decision; } },
      });

    const d = makeDispatcher({
      hotkey: make('modA', 'pass'),
      active: make('actA', 'pass'),
      ambient: [make('always1', 'pass'), make('always2', 'claim')],
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
      hotkey: make('modA', 'claim'),
      active: make('actA', 'claim'),
      ambient: [],
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
    const d = makeDispatcher({ hotkey: null, active: tool, ambient: [] });

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
    const d = makeDispatcher({ hotkey: null, active: tool, ambient: [] });

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
    const d = makeDispatcher({ hotkey: null, active: tool, ambient: [] });

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
    const d = makeDispatcher({ hotkey: null, active: tool, ambient: [] });

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
    const d = makeDispatcher({ hotkey: null, active: tool, ambient: [] });

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
    const d = makeDispatcher({ hotkey: null, active: tool, ambient: [] });

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
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
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
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
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
    const d = makeDblDispatcher({ hotkey: null, active: tool, ambient: [] }, clock);

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
    const d = makeDblDispatcher({ hotkey: null, active: tool, ambient: [] }, clock, { windowMs: 300 });

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
    const d = makeDblDispatcher({ hotkey: null, active: tool, ambient: [] }, clock, { maxDistance: 8 });

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
    const d = makeDblDispatcher({ hotkey: null, active: tool, ambient: [] }, clock);

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
      { hotkey: make('mod', 'pass'), active: make('act', 'claim'), ambient: [make('always', 'claim')] },
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
    const d = makeDblDispatcher({ hotkey: null, active: tool, ambient: [] }, clock);

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
    const d = makeDblDispatcher({ hotkey: null, active: tool, ambient: [] }, clock);

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
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
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
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
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

describe('dispatcher: affordance hit-test pipeline', () => {
  function makeChromeState() {
    return {
      selection: [],
      multiActive: false,
      boundsOf: () => null,
      unionBounds: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    } as never;
  }

  it('layer hitTest claim routes drag.onStart/onMove/onEnd to the layer-supplied channel', () => {
    const events: string[] = [];
    const drag = {
      onStart: () => { events.push('start'); return undefined; },
      onMove: () => { events.push('move'); return undefined; },
      onEnd: () => { events.push('end'); return undefined; },
    };
    const layer = {
      id: 'aff',
      label: 'A',
      draw: () => [],
      hitTest: () => ({ drag }),
    };
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: null, ambient: [] }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
      getHitTestContext: () => ({
        layers: [layer as never],
        chromeState: makeChromeState(),
        view: { x: 0, y: 0, scale: 1 },
        dims: { width: 100, height: 100 },
      }),
    });
    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 5, clientY: 5 }));
    dispatcher.onPointerMove(pointerEvent('pointermove', { clientX: 6, clientY: 6 }));
    dispatcher.onPointerUp(pointerEvent('pointerup', { clientX: 6, clientY: 6 }));
    expect(events).toEqual(['start', 'move', 'end']);
  });

  it('null layer hitTest falls through; layer was consulted exactly once', () => {
    const layerHitTest = vi.fn(() => null);
    const layer = { id: 'aff', label: 'A', draw: () => [], hitTest: layerHitTest as never };
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: null, ambient: [] }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
      getHitTestContext: () => ({
        layers: [layer as never],
        chromeState: makeChromeState(),
        view: { x: 0, y: 0, scale: 1 },
        dims: { width: 100, height: 100 },
      }),
    });
    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 5, clientY: 5 }));
    expect(layerHitTest).toHaveBeenCalledTimes(1);
    expect(layerHitTest).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number),
      expect.anything(), expect.anything(), expect.anything(),
    );
  });

  it('modal claim (active.claimsAll → true) bypasses the layer pipeline', () => {
    const events: string[] = [];
    const layerHitTest = vi.fn(() => null);
    const activeOnDown = () => { events.push('active.onDown'); return 'claim' as const; };
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({
        hotkey: null,
        active: { id: 'pen', pointer: { onDown: activeOnDown }, claimsAll: () => true } as never,
        ambient: [],
      }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
      getHitTestContext: () => ({
        layers: [{ id: 'aff', label: 'A', draw: () => [], hitTest: layerHitTest as never } as never],
        chromeState: makeChromeState(),
        view: { x: 0, y: 0, scale: 1 },
        dims: { width: 100, height: 100 },
      }),
    });
    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 5, clientY: 5 }));
    expect(layerHitTest).not.toHaveBeenCalled();
    expect(events).toContain('active.onDown');
  });

  it('absent getHitTestContext: pure legacy slot-walk behavior preserved', () => {
    // No getHitTestContext supplied. Dispatcher should fall through directly
    // to the slot walk. Existing pointer.onDown handlers fire as before.
    const onDown = vi.fn(() => 'claim' as const);
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({
        hotkey: null,
        active: { id: 't', pointer: { onDown } } as never,
        ambient: [],
      }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
    });
    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 5, clientY: 5 }));
    expect(onDown).toHaveBeenCalledTimes(1);
  });
});

describe('dispatcher: ctx.target population on pointer events', () => {
  function makeChromeState() {
    return {
      selection: [],
      multiActive: false,
      boundsOf: () => null,
      unionBounds: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    } as never;
  }

  it('getNodeAtPoint returning null → ctx.target on click handler is empty hit', () => {
    let observedTarget: unknown = undefined;
    const tool = defineTool({
      id: 't',
      pointer: {
        onClick: (_e, ctx) => { observedTarget = ctx.target; return 'claim'; },
      },
    });
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
      getNodeAtPoint: () => null,
    });
    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 50, clientY: 50 }));
    dispatcher.onPointerUp(pointerEvent('pointerup', { clientX: 51, clientY: 50 }));
    expect(observedTarget).toEqual({ category: 'empty', kind: 'empty' });
  });

  it('getNodeAtPoint returning a node ref → ctx.target is NodeHit matching the ref', () => {
    const ref = {
      id: 'n1' as never,
      kind: 'rect',
      pose: { x: 1, y: 2, width: 3, height: 4 },
      data: { id: 'n1', kind: 'rect' },
      meta: { z: 7 },
    };
    let observedTarget: unknown = undefined;
    const tool = defineTool({
      id: 't',
      pointer: {
        onDown: (_e, ctx) => { observedTarget = ctx.target; return 'pass'; },
      },
    });
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
      getNodeAtPoint: () => ref,
    });
    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 50, clientY: 50 }));
    expect(observedTarget).toEqual({
      category: 'node',
      kind: 'rect',
      id: 'n1',
      pose: ref.pose,
      data: ref.data,
      meta: { z: 7 },
    });
  });

  it('no getNodeAtPoint supplied → ctx.target falls back to empty hit (always-populated default)', () => {
    // Decision: even without a callback, populate ctx.target with the empty
    // sentinel so declarative routing factories can match 'empty' rather than
    // guarding for undefined. Documented in dispatcher.ts:nodeHitFor.
    let observedTarget: unknown = undefined;
    const tool = defineTool({
      id: 't',
      pointer: {
        onDown: (_e, ctx) => { observedTarget = ctx.target; return 'pass'; },
      },
    });
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
    });
    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 50, clientY: 50 }));
    expect(observedTarget).toEqual({ category: 'empty', kind: 'empty' });
  });

  it('affordance pipeline still produces a category:affordance target', () => {
    let observedTarget: unknown = undefined;
    const drag = {
      onStart: (_e: PointerEvent, ctx: ToolCtx) => { observedTarget = ctx.target; return undefined; },
    };
    const layer = {
      id: 'aff',
      label: 'A',
      draw: () => [],
      // Layer hit yields an affordance binding; dispatcher should populate
      // ctx.target with category 'affordance', NOT 'empty', even when
      // getNodeAtPoint is wired.
      hitTest: () => ({ drag }),
    };
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: null, ambient: [] }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
      getHitTestContext: () => ({
        layers: [layer as never],
        chromeState: makeChromeState(),
        view: { x: 0, y: 0, scale: 1 },
        dims: { width: 100, height: 100 },
      }),
      getNodeAtPoint: () => ({
        id: 'n1' as never,
        kind: 'rect',
        pose: {},
        data: { id: 'n1' },
      }),
    });
    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 5, clientY: 5 }));
    expect((observedTarget as { category: string }).category).toBe('affordance');
  });
});
