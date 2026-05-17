import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHandTool } from './useHandTool';
import type { ToolCtx } from '../../types';
import type { View } from 'core/viewport/view';

function fakeEvent(clientX: number, clientY: number): PointerEvent {
  // jsdom doesn't implement PointerEvent constructor; fake it.
  const e = new Event('pointermove') as PointerEvent;
  Object.assign(e, { clientX, clientY });
  return e;
}

/** Sync ctx.screenPoint to match the event being passed, in place.
 *  Tests reuse one ctx across multiple handler calls; the factory
 *  writes scratch on that same ctx, so we must mutate rather than
 *  spread (a spread would drop scratch mutations on subsequent calls). */
function syncEvent<S>(ctx: ToolCtx<S>, e: PointerEvent): ToolCtx<S> {
  (ctx as { screenPoint?: { x: number; y: number } }).screenPoint =
    { x: e.clientX, y: e.clientY };
  return ctx;
}

function makeCtx<S = unknown>(view: Omit<View, 'scale'> & { scale?: { x: number; y: number } }, setView: (v: View) => void): ToolCtx<S> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: {} as never,
    adapter: null,
    applyOps: () => {},
    view: { ...view, scale: view.scale ?? { x: 1, y: 1 } },
    setView,
    canvasRect: new DOMRect(),
    scratch: undefined as unknown as S,
  };
}

describe('useHandTool', () => {
  it('declares H keybinding and space hotkey trigger', () => {
    const { result } = renderHook(() => useHandTool());
    expect(result.current.id).toBe('hand');
    expect(result.current.keybinding).toEqual({ key: 'H' });
    expect(result.current.hotkey).toBe('space');
  });

  it('drag.onStart captures startView + start client coords; returns claim', () => {
    const { result } = renderHook(() => useHandTool());
    const tool = result.current;
    const setView = vi.fn();
    const ctx = makeCtx<any>({ x: 30, y: 40 }, setView);
    const startE = fakeEvent(100, 200);
    const decision = tool.drag!.onStart!(startE, syncEvent(ctx, startE));
    expect(decision).toBe('claim');
    // scratch is held in ctx (caller may have replaced it); we verify next move
    // uses the captured startView + startClient.
    const moveE = fakeEvent(110, 215);
    const moveDecision = tool.drag!.onMove!(moveE, syncEvent(ctx, moveE));
    expect(moveDecision).toBe('claim');
    // dx = 10, dy = 15 → new view = startView - delta = (30-10, 40-15)
    expect(setView).toHaveBeenCalledWith({ x: 20, y: 25, scale: { x: 1, y: 1 } });
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

describe('useHandTool — cursor phase override', () => {
  it('idle cursor is grab when scratch is null', () => {
    const { result } = renderHook(() => useHandTool());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = makeCtx<any>({ x: 0, y: 0 }, () => {});
    // scratch is undefined on freshly-made ctx; coerce null shape.
    (ctx as { scratch: unknown }).scratch = null;
    const cursor = typeof result.current.cursor === 'function'
      ? (result.current.cursor as (c: ToolCtx) => string)(ctx)
      : result.current.cursor;
    expect(cursor).toBe('grab');
  });

  it('engaged cursor is grabbing when scratch is set', () => {
    const { result } = renderHook(() => useHandTool());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = makeCtx<any>({ x: 0, y: 0 }, () => {});
    (ctx as { scratch: unknown }).scratch = {
      startView: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      startScreenPoint: { x: 0, y: 0 },
    };
    const cursor = typeof result.current.cursor === 'function'
      ? (result.current.cursor as (c: ToolCtx) => string)(ctx)
      : result.current.cursor;
    expect(cursor).toBe('grabbing');
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
    const startE = fakeEvent(0, 0);
    tool.drag!.onStart!(startE, syncEvent(ctx, startE));
    tool.drag!.onMove!(startE, syncEvent(ctx,startE));
    for (let i = 1; i <= 5; i++) {
      const me = fakeEvent(i * 10, 0);
      tool.drag!.onMove!(me, syncEvent(ctx,me));
    }
    setView.mockClear();
    const endE = fakeEvent(50, 0);
    tool.drag!.onEnd!(endE, syncEvent(ctx, endE));
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
    const startE = fakeEvent(0, 0);
    tool.drag!.onStart!(startE, syncEvent(ctx, startE));
    for (let i = 1; i <= 5; i++) {
      const me = fakeEvent(i * 10, 0);
      tool.drag!.onMove!(me, syncEvent(ctx,me));
    }
    const endE = fakeEvent(50, 0);
    tool.drag!.onEnd!(endE, syncEvent(ctx, endE));
    // First-frame skip then one real tick
    act(() => { stepRAF(16); });
    act(() => { stepRAF(16); });
    // Inertia is active — verify setView was called
    expect(setView).toHaveBeenCalled();

    // New drag starts — should cancel inertia
    const restartE = fakeEvent(0, 0);
    tool.drag!.onStart!(restartE, syncEvent(ctx, restartE));
    setView.mockClear();

    // Run several more frames — inertia should NOT continue
    act(() => { stepRAF(16); });
    act(() => { stepRAF(16); });
    act(() => { stepRAF(16); });
    // setView should NOT be called by inertia after cancel
    // (it could be called zero times; onStart itself doesn't call setView)
    expect(setView).not.toHaveBeenCalled();
  });

  describe('axis option', () => {
    it('axis="x": drag delta only moves x; y stays at startView.y', () => {
      const { result } = renderHook(() => useHandTool({ axis: 'x' }));
      const tool = result.current;
      const setView = vi.fn();
      const ctx = makeCtx<any>({ x: 30, y: 40 }, setView);
      tool.drag!.onStart!(fakeEvent(100, 200), syncEvent(ctx, fakeEvent(100, 200)));
      const moveE = fakeEvent(110, 215);
      tool.drag!.onMove!(moveE, syncEvent(ctx, moveE));
      // dx = 10, dy = 15 — but axis='x' gates dy → y unchanged.
      expect(setView).toHaveBeenCalledWith({ x: 20, y: 40, scale: { x: 1, y: 1 } });
    });

    it('axis="y": drag delta only moves y; x stays at startView.x', () => {
      const { result } = renderHook(() => useHandTool({ axis: 'y' }));
      const tool = result.current;
      const setView = vi.fn();
      const ctx = makeCtx<any>({ x: 30, y: 40 }, setView);
      tool.drag!.onStart!(fakeEvent(100, 200), syncEvent(ctx, fakeEvent(100, 200)));
      const moveE = fakeEvent(110, 215);
      tool.drag!.onMove!(moveE, syncEvent(ctx, moveE));
      // dx = 10, dy = 15 — axis='y' gates dx → x unchanged.
      expect(setView).toHaveBeenCalledWith({ x: 30, y: 25, scale: { x: 1, y: 1 } });
    });

    it('axis="both" (default) moves both axes', () => {
      const { result } = renderHook(() => useHandTool({ axis: 'both' }));
      const tool = result.current;
      const setView = vi.fn();
      const ctx = makeCtx<any>({ x: 30, y: 40 }, setView);
      tool.drag!.onStart!(fakeEvent(100, 200), syncEvent(ctx, fakeEvent(100, 200)));
      const moveE = fakeEvent(110, 215);
      tool.drag!.onMove!(moveE, syncEvent(ctx, moveE));
      expect(setView).toHaveBeenCalledWith({ x: 20, y: 25, scale: { x: 1, y: 1 } });
    });
  });
});
