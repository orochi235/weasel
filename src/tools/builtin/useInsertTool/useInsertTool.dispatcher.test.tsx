// Regression guard for "every other drag-to-insert is ignored" (the
// InsertDemo doubledrag bug). Drives useInsertTool through the real
// dispatcher (pointerdown → pointermove × N → pointerup), repeated, and
// asserts every gesture commits.
//
// History: a user report claimed InsertDemo dropped every other commit.
// Investigation could not reproduce under vitest, synthetic PointerEvents,
// or Playwright native mouse events — this test pins the dispatcher path
// for the consumer-shaped case so any future regression in the activeSpec
// slot or in dispatcher inFlight lifecycle fails loudly.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInsertTool } from './useInsertTool';
import { createToolsDispatcher } from '../../dispatcher';
import type { ToolCtx, AnyTool } from '../../types';

function makeBaseCtx(over: Partial<ToolCtx> = {}): Omit<ToolCtx, 'scratch'> {
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
    ...over,
  };
}

function pe(type: string, init: Partial<PointerEventInit> = {}): PointerEvent {
  const ev = new Event(type) as PointerEvent;
  Object.assign(ev, { clientX: 0, clientY: 0, pointerId: 1, ...init });
  return ev;
}

describe('useInsertTool through dispatcher — consecutive drags', () => {
  it('every drag commits, not every other one', () => {
    const commitInsert = vi.fn((b: any) => ({ id: `n${commitInsert.mock.calls.length}`, ...b }));
    const adapter = {
      getSelection: () => [],
      commitInsert,
      commitPaste: vi.fn(() => []),
      snapshotSelection: vi.fn(),
      insertNode: vi.fn(),
      setSelection: vi.fn(),
      applyOps: vi.fn(),
    } as any;

    let cursor = { x: 0, y: 0 };
    const { result } = renderHook(() => useInsertTool(adapter, {}));

    const getCtx = (): Omit<ToolCtx, 'scratch'> =>
      makeBaseCtx({ worldX: cursor.x, worldY: cursor.y });

    const tool: AnyTool = result.current as AnyTool;
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
      getCtx: getCtx as never,
      threshold: 4,
    });

    const drag = (sx: number, sy: number, ex: number, ey: number) => {
      cursor = { x: sx, y: sy };
      act(() => dispatcher.onPointerDown(pe('pointerdown', { clientX: sx, clientY: sy })));
      // Two moves: one to cross threshold (fires onStart), one to grow bounds
      // past minBounds so the release commits rather than going sub-threshold.
      const mx = sx + 5, my = sy + 5;
      cursor = { x: mx, y: my };
      act(() => dispatcher.onPointerMove(pe('pointermove', { clientX: mx, clientY: my })));
      cursor = { x: ex, y: ey };
      act(() => dispatcher.onPointerMove(pe('pointermove', { clientX: ex, clientY: ey })));
      act(() => dispatcher.onPointerUp(pe('pointerup', { clientX: ex, clientY: ey })));
    };

    drag(0, 0, 50, 50);
    drag(60, 60, 110, 110);
    drag(120, 120, 170, 170);
    drag(180, 180, 230, 230);

    expect(commitInsert).toHaveBeenCalledTimes(4);
  });
});
