import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragGesture, type DragGestureController } from './dragGesture';
import type { ModifierState } from '../types';

const NO_MODS: ModifierState = { shift: false, alt: false, meta: false, ctrl: false };
const P = (x: number, y: number) => ({ worldX: x, worldY: y, clientX: x, clientY: y });

describe('useDragGesture ended from inside or outside', () => {
  it('an onActivate that cancels gets no onMove for the move that activated it', () => {
    const ref: { c: DragGestureController | null } = { c: null };
    const onMove = vi.fn();
    const { result } = renderHook(() => useDragGesture({
      thresholdReached: () => true,
      onActivate: () => ref.c!.cancel(),
      onMove,
    }));
    ref.c = result.current;
    act(() => result.current.start(P(0, 0), NO_MODS));
    expect(() => act(() => { result.current.move(P(10, 0), NO_MODS); })).not.toThrow();
    expect(onMove).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });

  it('an onActivate that restarts gives the old gesture no onMove', () => {
    const ref: { c: DragGestureController | null } = { c: null };
    const seen: unknown[] = [];
    const { result } = renderHook(() => useDragGesture({
      thresholdReached: () => true,
      onActivate: () => ref.c!.start(P(99, 99), NO_MODS),
      onMove: (ctx) => seen.push(ctx.start),
    }));
    ref.c = result.current;
    act(() => result.current.start(P(0, 0), NO_MODS));
    act(() => { result.current.move(P(10, 0), NO_MODS); });
    expect(seen).toEqual([]);
  });

  it('an onEnd that cancels closes the gesture once', () => {
    const ref: { c: DragGestureController | null } = { c: null };
    const onGestureEnd = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() => useDragGesture({
      onEnd: () => ref.c!.cancel(),
      onCancel,
      onGestureEnd,
    }));
    ref.c = result.current;
    act(() => result.current.start(P(0, 0), NO_MODS));
    act(() => result.current.end());
    expect(onCancel).not.toHaveBeenCalled();
    expect(onGestureEnd).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('an onEnd that starts the next gesture leaves it live', () => {
    const ref: { c: DragGestureController | null } = { c: null };
    let chained = false;
    const onGestureStart = vi.fn();
    const onGestureEnd = vi.fn();
    const onMove = vi.fn();
    const { result } = renderHook(() => useDragGesture({
      onEnd: () => { if (!chained) { chained = true; ref.c!.start(P(5, 5), NO_MODS); } },
      onMove,
      onGestureStart,
      onGestureEnd,
    }));
    ref.c = result.current;
    act(() => result.current.start(P(0, 0), NO_MODS));
    act(() => result.current.end());
    expect(result.current.phase).toBe('active');
    expect(onGestureStart).toHaveBeenCalledTimes(2);
    expect(onGestureEnd).toHaveBeenCalledOnce();
    act(() => { expect(result.current.move(P(9, 9), NO_MODS)).toBe(true); });
    expect(onMove.mock.calls[0][0].start).toEqual(P(5, 5));
    act(() => result.current.end());
    expect(onGestureEnd).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('idle');
  });

  it('an onCancel that starts the next gesture leaves it live', () => {
    const ref: { c: DragGestureController | null } = { c: null };
    let chained = false;
    const { result } = renderHook(() => useDragGesture({
      onCancel: () => { if (!chained) { chained = true; ref.c!.start(P(5, 5), NO_MODS); } },
    }));
    ref.c = result.current;
    act(() => result.current.start(P(0, 0), NO_MODS));
    act(() => result.current.cancel());
    expect(result.current.phase).toBe('active');
  });

  it('unmounting mid-gesture cancels it, closing onGestureStart with onGestureEnd(false)', () => {
    const onGestureEnd = vi.fn();
    const onCancel = vi.fn();
    const { result, unmount } = renderHook(() => useDragGesture({ onGestureEnd, onCancel }));
    act(() => result.current.start(P(0, 0), NO_MODS));
    unmount();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onGestureEnd).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('unmounting while idle fires nothing', () => {
    const onGestureEnd = vi.fn();
    const { unmount } = renderHook(() => useDragGesture({ onGestureEnd }));
    unmount();
    expect(onGestureEnd).not.toHaveBeenCalled();
  });
});
