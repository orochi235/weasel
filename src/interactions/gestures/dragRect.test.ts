import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragRect, type DragRectCtx, type DragRectEndCtx } from './dragRect';

const NO_MODS = { shift: false, alt: false, meta: false, ctrl: false };

describe('useDragRect', () => {
  it('start sets overlay and fires onGestureStart and onStart', () => {
    const onStart = vi.fn();
    const onGestureStart = vi.fn();
    const { result } = renderHook(() => useDragRect({ onStart, onGestureStart }));
    act(() => result.current.start(10, 20, NO_MODS));
    expect(result.current.overlay).toEqual({
      start: { x: 10, y: 20 },
      current: { x: 10, y: 20 },
      bounds: { x: 10, y: 20, width: 0, height: 0 },
    });
    expect(result.current.isActive).toBe(true);
    expect(onStart).toHaveBeenCalledOnce();
    expect(onGestureStart).toHaveBeenCalledOnce();
    const ctx = onStart.mock.calls[0][0];
    expect(ctx.start).toEqual({ x: 10, y: 20 });
    expect(ctx.bounds).toEqual({ x: 10, y: 20, width: 0, height: 0 });
  });

  it('move updates current and bounds; returns true while active', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useDragRect({ onMove }));
    expect(result.current.move(50, 50, NO_MODS)).toBe(false);
    act(() => result.current.start(10, 10, NO_MODS));
    let returned = false;
    act(() => { returned = result.current.move(40, 30, NO_MODS); });
    expect(returned).toBe(true);
    expect(result.current.overlay).toEqual({
      start: { x: 10, y: 10 },
      current: { x: 40, y: 30 },
      bounds: { x: 10, y: 10, width: 30, height: 20 },
    });
    expect(onMove).toHaveBeenCalledOnce();
  });

  it('bounds normalize when current is above-left of start', () => {
    const { result } = renderHook(() => useDragRect());
    act(() => result.current.start(50, 50, NO_MODS));
    act(() => result.current.move(20, 10, NO_MODS));
    expect(result.current.overlay!.bounds).toEqual({ x: 20, y: 10, width: 30, height: 40 });
  });

  it('end fires onEnd with wasSubThreshold flag and onGestureEnd(committed)', () => {
    const onEnd = vi.fn((_ctx: DragRectEndCtx) => true);
    const onGestureEnd = vi.fn();
    const { result } = renderHook(() =>
      useDragRect({ minBounds: { width: 4, height: 4 }, onEnd, onGestureEnd }),
    );
    act(() => result.current.start(10, 10, NO_MODS));
    act(() => result.current.move(12, 12, NO_MODS));
    act(() => result.current.end());
    expect(onEnd).toHaveBeenCalledOnce();
    const ctx = onEnd.mock.calls[0][0];
    expect(ctx.bounds).toEqual({ x: 10, y: 10, width: 2, height: 2 });
    expect(ctx.wasSubThreshold).toBe(true);
    expect(onGestureEnd).toHaveBeenCalledWith(true);
    expect(result.current.overlay).toBeNull();
    expect(result.current.isActive).toBe(false);
  });

  it('end with onEnd returning false reports onGestureEnd(false)', () => {
    const onGestureEnd = vi.fn();
    const { result } = renderHook(() => useDragRect({ onEnd: () => false, onGestureEnd }));
    act(() => result.current.start(0, 0, NO_MODS));
    act(() => result.current.move(100, 100, NO_MODS));
    act(() => result.current.end());
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('end with no active gesture is a no-op except onGestureEnd(false)', () => {
    const onEnd = vi.fn();
    const onGestureEnd = vi.fn();
    const { result } = renderHook(() => useDragRect({ onEnd, onGestureEnd }));
    act(() => result.current.end());
    expect(onEnd).not.toHaveBeenCalled();
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('cancel calls onCancel with active ctx and onGestureEnd(false)', () => {
    const onCancel = vi.fn();
    const onGestureEnd = vi.fn();
    const { result } = renderHook(() => useDragRect({ onCancel, onGestureEnd }));
    act(() => result.current.start(10, 10, NO_MODS));
    act(() => result.current.move(20, 20, NO_MODS));
    act(() => result.current.cancel());
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCancel.mock.calls[0][0].current).toEqual({ x: 20, y: 20 });
    expect(onGestureEnd).toHaveBeenCalledWith(false);
    expect(result.current.overlay).toBeNull();
  });

  it('initScratch is invoked at start; mutations persist across callbacks', () => {
    interface S { hits: number }
    const init = vi.fn<() => S>(() => ({ hits: 0 }));
    const onStart = vi.fn((c: DragRectCtx<S>) => { c.scratch.hits++; });
    const onMove = vi.fn((c: DragRectCtx<S>) => { c.scratch.hits++; });
    const onEnd = vi.fn((c: DragRectEndCtx<S>) => {
      expect(c.scratch.hits).toBe(2);
    });
    const { result } = renderHook(() =>
      useDragRect<S>({ initScratch: init, onStart, onMove, onEnd }),
    );
    act(() => result.current.start(0, 0, NO_MODS));
    act(() => result.current.move(10, 10, NO_MODS));
    act(() => result.current.end());
    expect(init).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('setStart and setCurrent mid-gesture update bounds and overlay', () => {
    const { result } = renderHook(() =>
      useDragRect({
        onMove: (c) => {
          if (c.current.x === 30) c.setStart({ x: 5, y: 5 });
        },
      }),
    );
    act(() => result.current.start(10, 10, NO_MODS));
    act(() => result.current.move(30, 30, NO_MODS));
    expect(result.current.overlay).toEqual({
      start: { x: 5, y: 5 },
      current: { x: 30, y: 30 },
      bounds: { x: 5, y: 5, width: 25, height: 25 },
    });
  });
});
