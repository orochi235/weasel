import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHandTool } from './useHandTool';
import type { ToolCtx } from '../types';
import type { View } from 'core/viewport/view';

function fakeEvent(clientX: number, clientY: number): PointerEvent {
  // jsdom doesn't implement PointerEvent constructor; fake it.
  const e = new Event('pointermove') as PointerEvent;
  Object.assign(e, { clientX, clientY });
  return e;
}

function makeCtx<S = unknown>(view: Omit<View, 'scale'> & { scale?: number }, setView: (v: View) => void): ToolCtx<S> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: {} as never,
    adapter: null,
    applyBatch: () => {},
    view: { ...view, scale: view.scale ?? 1 },
    setView,
    canvasRect: new DOMRect(),
    scratch: undefined as unknown as S,
  };
}

describe('useHandTool', () => {
  it('declares H keybinding and space hotkey trigger', () => {
    const { result } = renderHook(() => useHandTool());
    expect(result.current.id).toBe('hand');
    expect(result.current.keybinding).toBe('H');
    expect(result.current.hotkey).toBe('space');
  });

  it('drag.onStart captures startView + start client coords; returns claim', () => {
    const { result } = renderHook(() => useHandTool());
    const tool = result.current;
    const setView = vi.fn();
    const ctx = makeCtx<any>({ x: 30, y: 40 }, setView);
    const decision = tool.drag!.onStart!(fakeEvent(100, 200), ctx);
    expect(decision).toBe('claim');
    // scratch is held in ctx (caller may have replaced it); we verify next move
    // uses the captured startView + startClient.
    const moveDecision = tool.drag!.onMove!(fakeEvent(110, 215), ctx);
    expect(moveDecision).toBe('claim');
    // dx = 10, dy = 15 → new view = startView - delta = (30-10, 40-15)
    expect(setView).toHaveBeenCalledWith({ x: 20, y: 25, scale: 1 });
  });

  it('drag.onMove with no preceding onStart is a no-op pass', () => {
    const { result } = renderHook(() => useHandTool());
    const setView = vi.fn();
    const ctx = makeCtx<any>({ x: 0, y: 0 }, setView);
    const decision = result.current.drag!.onMove!(fakeEvent(50, 50), ctx);
    // pass through — no scratch means no captured start, can't pan.
    expect(decision).toBe('pass');
    expect(setView).not.toHaveBeenCalled();
  });

  it('drag.onEnd clears scratch (next onMove is a no-op pass)', () => {
    const { result } = renderHook(() => useHandTool());
    const tool = result.current;
    const setView = vi.fn();
    const ctx = makeCtx<any>({ x: 0, y: 0 }, setView);
    tool.drag!.onStart!(fakeEvent(0, 0), ctx);
    tool.drag!.onEnd!(fakeEvent(10, 10), ctx);
    setView.mockClear();
    const decision = tool.drag!.onMove!(fakeEvent(20, 20), ctx);
    expect(decision).toBe('pass');
    expect(setView).not.toHaveBeenCalled();
  });

  it('cursor is grab when idle, grabbing when scratch is non-null', () => {
    const { result } = renderHook(() => useHandTool());
    const tool = result.current;
    const setView = vi.fn();
    const ctx = makeCtx<any>({ x: 0, y: 0 }, setView);
    expect(typeof tool.cursor).toBe('function');
    expect((tool.cursor as (ctx: ToolCtx) => string)(ctx)).toBe('grab');
    // After onStart, scratch is non-null on the ctx.
    tool.drag!.onStart!(fakeEvent(0, 0), ctx);
    expect((tool.cursor as (ctx: ToolCtx) => string)(ctx)).toBe('grabbing');
  });
});

// RAF fake (same pattern as useDecayLoop tests)
let rafCallbacks: Array<(t: number) => void> = [];
let rafTime = 0;
function stepRAF(dt = 16) {
  rafTime += dt;
  const cbs = rafCallbacks.splice(0);
  for (const cb of cbs) cb(rafTime);
}
let nowTime = 0;

describe('useHandTool with inertia', () => {
  beforeEach(() => {
    rafCallbacks = []; rafTime = 0; nowTime = 1000;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => { rafCallbacks.push(cb); return rafCallbacks.length; });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.spyOn(Date, 'now').mockImplementation(() => { nowTime += 16; return nowTime; });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('calls setView after drag ends when inertia is configured', () => {
    const { result } = renderHook(() => useHandTool({ inertia: { friction: 0.9, minSpeed: 0.0001 } }));
    const tool = result.current;
    const setView = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = makeCtx<any>({ x: 0, y: 0 }, setView);

    // Simulate a fast drag
    tool.drag!.onStart!(fakeEvent(0, 0), ctx);
    tool.drag!.onMove!(fakeEvent(0, 0), { ...ctx, worldX: 0, worldY: 0 });
    for (let i = 1; i <= 5; i++) {
      tool.drag!.onMove!(fakeEvent(i * 10, 0), { ...ctx, worldX: 0, worldY: 0 });
    }
    setView.mockClear();
    tool.drag!.onEnd!(fakeEvent(50, 0), ctx);
    // Step past useDecayLoop's first-frame skip, then one actual tick
    act(() => { stepRAF(16); });
    act(() => { stepRAF(16); });
    expect(setView).toHaveBeenCalled();
  });

  it('cancels decay on next drag start', () => {
    const { result } = renderHook(() => useHandTool({ inertia: { friction: 0.9, minSpeed: 0.0001 } }));
    const tool = result.current;
    const setView = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = makeCtx<any>({ x: 0, y: 0 }, setView);

    // Start a drag with real velocity
    tool.drag!.onStart!(fakeEvent(0, 0), ctx);
    for (let i = 1; i <= 5; i++) {
      tool.drag!.onMove!(fakeEvent(i * 10, 0), { ...ctx, worldX: 0, worldY: 0 });
    }
    tool.drag!.onEnd!(fakeEvent(50, 0), ctx);
    // First-frame skip then one real tick
    act(() => { stepRAF(16); });
    act(() => { stepRAF(16); });
    // Inertia is active — verify setView was called
    expect(setView).toHaveBeenCalled();

    // New drag starts — should cancel inertia
    tool.drag!.onStart!(fakeEvent(0, 0), ctx);
    setView.mockClear();

    // Run several more frames — inertia should NOT continue
    act(() => { stepRAF(16); });
    act(() => { stepRAF(16); });
    act(() => { stepRAF(16); });
    // setView should NOT be called by inertia after cancel
    // (it could be called zero times; onStart itself doesn't call setView)
    expect(setView).not.toHaveBeenCalled();
  });
});
