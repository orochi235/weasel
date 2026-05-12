import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWheelPanTool } from './useWheelPanTool';
import type { ToolCtx } from '../types';
import type { View } from 'core/viewport/view';

function makeCtx(view: View, setView: (v: View) => void): ToolCtx<null> {
  return {
    worldX: 0, worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: {} as never,
    adapter: null,
    applyOps: () => {},
    view, setView,
    canvasRect: new DOMRect(),
    scratch: null,
  };
}

function wheel(init: Partial<WheelEventInit> & { ctrlKey?: boolean }): WheelEvent {
  const e = new Event('wheel') as WheelEvent;
  Object.assign(e, {
    deltaX: 0, deltaY: 0, deltaZ: 0, deltaMode: 0,
    clientX: 0, clientY: 0,
    ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
    preventDefault: vi.fn(),
    ...init,
  });
  return e;
}

describe('useWheelPanTool', () => {
  it('passes when ctrlKey is true (lets wheel-zoom claim)', () => {
    const { result } = renderHook(() => useWheelPanTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: 1 }, setView);
    const e = wheel({ deltaX: 10, deltaY: 5, ctrlKey: true });
    expect(result.current.wheel!.onWheel!(e, ctx)).toBe('pass');
    expect(setView).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('translates by (deltaX/scale, deltaY/scale) under scale=1', () => {
    const { result } = renderHook(() => useWheelPanTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: 1 }, setView);
    const e = wheel({ deltaX: 20, deltaY: 10 });
    expect(result.current.wheel!.onWheel!(e, ctx)).toBe('claim');
    expect(setView).toHaveBeenCalledWith({ x: 20, y: 10, scale: 1 });
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('translates by (deltaX/scale, deltaY/scale) under scale=2', () => {
    const { result } = renderHook(() => useWheelPanTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 5, y: 5, scale: 2 }, setView);
    const e = wheel({ deltaX: 20, deltaY: 10 });
    result.current.wheel!.onWheel!(e, ctx);
    expect(setView).toHaveBeenCalledWith({ x: 5 + 10, y: 5 + 5, scale: 2 });
  });

  it('preserves scale', () => {
    const { result } = renderHook(() => useWheelPanTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: 3 }, setView);
    result.current.wheel!.onWheel!(wheel({ deltaX: 0, deltaY: 0 }), ctx);
    expect((setView.mock.calls[0][0] as View).scale).toBe(3);
  });

  describe('inertia', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('is off by default — no setView calls after wheel stops', () => {
      const { result } = renderHook(() => useWheelPanTool());
      const setView = vi.fn();
      const ctx = makeCtx({ x: 0, y: 0, scale: 1 }, setView);
      result.current.wheel!.onWheel!(wheel({ deltaX: 10, deltaY: 5 }), ctx);
      expect(setView).toHaveBeenCalledTimes(1);

      // Advance well past any plausible idle window; no further setView.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(setView).toHaveBeenCalledTimes(1);
    });

    it('invokes setView after wheel stops when inertia is enabled', async () => {
      const rafCallbacks: FrameRequestCallback[] = [];
      const rafSpy = vi
        .spyOn(globalThis, 'requestAnimationFrame')
        .mockImplementation((cb: FrameRequestCallback) => {
          rafCallbacks.push(cb);
          return rafCallbacks.length as unknown as number;
        });
      vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useWheelPanTool({ inertia: { friction: 0.9, minSpeed: 0.001, idleMs: 50 } }),
      );
      const setView = vi.fn();
      let view: View = { x: 0, y: 0, scale: 1 };
      const ctxSetView = (v: View) => { view = v; setView(v); };

      // Drive a few wheel events with timestamps so velocity tracker has signal.
      const now0 = Date.now();
      vi.setSystemTime(now0);
      result.current.wheel!.onWheel!(wheel({ deltaX: 10, deltaY: 0 }), makeCtx(view, ctxSetView));
      vi.setSystemTime(now0 + 16);
      result.current.wheel!.onWheel!(wheel({ deltaX: 10, deltaY: 0 }), makeCtx(view, ctxSetView));
      vi.setSystemTime(now0 + 32);
      result.current.wheel!.onWheel!(wheel({ deltaX: 10, deltaY: 0 }), makeCtx(view, ctxSetView));

      const directCalls = setView.mock.calls.length;
      expect(directCalls).toBeGreaterThanOrEqual(3);

      // Trip the idle timer → decay loop schedules a RAF.
      act(() => {
        vi.advanceTimersByTime(60);
      });

      // Drain RAF callbacks; the loop should keep producing setView calls.
      let t = now0 + 100;
      for (let i = 0; i < 10 && rafCallbacks.length > 0; i++) {
        const cb = rafCallbacks.shift()!;
        cb(t);
        t += 16;
      }

      expect(setView.mock.calls.length).toBeGreaterThan(directCalls);
      rafSpy.mockRestore();
    });

    it('cancels in-flight inertia when a new wheel event arrives', () => {
      const rafCallbacks: FrameRequestCallback[] = [];
      let cancelled = 0;
      vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
        (cb: FrameRequestCallback) => {
          rafCallbacks.push(cb);
          return rafCallbacks.length as unknown as number;
        },
      );
      vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {
        cancelled++;
      });

      const { result } = renderHook(() =>
        useWheelPanTool({ inertia: { friction: 0.9, minSpeed: 0.001, idleMs: 50 } }),
      );
      const setView = vi.fn();
      let view: View = { x: 0, y: 0, scale: 1 };
      const ctxSetView = (v: View) => { view = v; setView(v); };

      const now0 = Date.now();
      vi.setSystemTime(now0);
      result.current.wheel!.onWheel!(wheel({ deltaX: 10, deltaY: 0 }), makeCtx(view, ctxSetView));
      vi.setSystemTime(now0 + 16);
      result.current.wheel!.onWheel!(wheel({ deltaX: 10, deltaY: 0 }), makeCtx(view, ctxSetView));

      // Kick off inertia.
      act(() => {
        vi.advanceTimersByTime(60);
      });
      expect(rafCallbacks.length).toBeGreaterThan(0);
      const cancelledBefore = cancelled;

      // New wheel event mid-inertia → decay.cancel() must run.
      vi.setSystemTime(now0 + 200);
      result.current.wheel!.onWheel!(wheel({ deltaX: 5, deltaY: 0 }), makeCtx(view, ctxSetView));
      expect(cancelled).toBeGreaterThan(cancelledBefore);
    });
  });
});
