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
