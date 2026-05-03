// src/tools/dispatcher.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createToolsDispatcher, type ToolsDispatcher } from './dispatcher';
import { defineTool } from './defineTool';
import type { Tool, ToolCtx } from './types';

function makeCtx(over: Partial<ToolCtx> = {}): ToolCtx {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { get: () => [], set: () => {}, add: () => {}, remove: () => {}, toggle: () => {}, clear: () => {}, applyClick: () => {} } as never,
    adapter: null,
    applyBatch: () => {},
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
  modifier: Tool | null;
  active: Tool | null;
  alwaysOn: Tool[];
}

function makeDispatcher(slots: SlotsState): ToolsDispatcher {
  return createToolsDispatcher({
    getSlots: () => slots,
    getCtx: makeCtx,
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

  it('pointer.onDown is the escape hatch — fires before threshold and suppresses drag/click when claimed', () => {
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
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    d.onPointerUp(pointerEvent('pointerup'));

    expect(onDown).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
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
