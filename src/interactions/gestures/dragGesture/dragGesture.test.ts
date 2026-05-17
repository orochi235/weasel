import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragGesture, type DragGestureCtx, type DragGestureEndCtx } from './dragGesture';
import type { ModifierState } from '../types';

const NO_MODS: ModifierState = { shift: false, alt: false, meta: false, ctrl: false };
const SHIFT: ModifierState = { shift: true, alt: false, meta: false, ctrl: false };
const P = (worldX: number, worldY: number, clientX = worldX, clientY = worldY) =>
  ({ worldX, worldY, clientX, clientY });

describe('useDragGesture', () => {
  describe('phase machine — no thresholdReached', () => {
    it('start activates immediately, fires onGestureStart and onStart', () => {
      const onStart = vi.fn();
      const onGestureStart = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onStart, onGestureStart }));
      expect(result.current.phase).toBe('idle');
      act(() => result.current.start(P(10, 20), NO_MODS));
      expect(result.current.phase).toBe('active');
      expect(result.current.isActive).toBe(true);
      expect(onGestureStart).toHaveBeenCalledOnce();
      expect(onStart).toHaveBeenCalledOnce();
      const ctx = onStart.mock.calls[0][0] as DragGestureCtx;
      expect(ctx.phase).toBe('active');
      expect(ctx.start).toEqual(P(10, 20));
    });

    it('onActivate is never called when thresholdReached is omitted', () => {
      const onActivate = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onActivate }));
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.move(P(50, 50), NO_MODS));
      expect(onActivate).not.toHaveBeenCalled();
    });
  });

  describe('phase machine — with thresholdReached', () => {
    it('starts in pending; activates only when predicate returns true', () => {
      const onStart = vi.fn();
      const onActivate = vi.fn();
      const onMove = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({
          thresholdReached: (ctx) =>
            Math.abs(ctx.current.clientX - ctx.start.clientX) >= 4,
          onStart,
          onActivate,
          onMove,
        }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      expect(result.current.phase).toBe('pending');
      expect(onStart).toHaveBeenCalledOnce();
      const startCtx = onStart.mock.calls[0][0] as DragGestureCtx;
      expect(startCtx.phase).toBe('pending');
      // Sub-threshold move: phase stays pending; onMove still fires; onActivate doesn't.
      act(() => result.current.move(P(2, 0), NO_MODS));
      expect(result.current.phase).toBe('pending');
      expect(onActivate).not.toHaveBeenCalled();
      expect(onMove).toHaveBeenCalledOnce();
      // Threshold-crossing move: phase flips before onMove for that move.
      act(() => result.current.move(P(5, 0), NO_MODS));
      expect(result.current.phase).toBe('active');
      expect(onActivate).toHaveBeenCalledOnce();
      const activateCtx = onActivate.mock.calls[0][0] as DragGestureCtx;
      expect(activateCtx.phase).toBe('active');
      expect(onMove).toHaveBeenCalledTimes(2);
      expect((onMove.mock.calls[1][0] as DragGestureCtx).phase).toBe('active');
    });

    it('thresholdReached called on every pending move; not after activation', () => {
      const thresholdReached = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
      const { result } = renderHook(() => useDragGesture({ thresholdReached }));
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.move(P(1, 0), NO_MODS));
      expect(thresholdReached).toHaveBeenCalledTimes(1);
      act(() => result.current.move(P(2, 0), NO_MODS));
      expect(thresholdReached).toHaveBeenCalledTimes(2);
      act(() => result.current.move(P(3, 0), NO_MODS));
      // After activation, predicate is no longer consulted.
      expect(thresholdReached).toHaveBeenCalledTimes(2);
    });
  });

  describe('move return value', () => {
    it('returns false when no gesture is in flight', () => {
      const { result } = renderHook(() => useDragGesture());
      expect(result.current.move(P(0, 0), NO_MODS)).toBe(false);
    });

    it('returns true after start, regardless of phase', () => {
      const { result } = renderHook(() =>
        useDragGesture({ thresholdReached: () => false }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      let r = false;
      act(() => { r = result.current.move(P(50, 50), NO_MODS); });
      expect(r).toBe(true);
      // Still pending — predicate keeps returning false.
      expect(result.current.phase).toBe('pending');
    });
  });

  describe('end + onEnd', () => {
    it('fires onEnd with wasSubThreshold=false when phase reached active', () => {
      const onEnd = vi.fn();
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onEnd, onGestureEnd }));
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.end());
      expect(onEnd).toHaveBeenCalledOnce();
      const endCtx = onEnd.mock.calls[0][0] as DragGestureEndCtx;
      expect(endCtx.wasSubThreshold).toBe(false);
      expect(onGestureEnd).toHaveBeenCalledWith(true);
    });

    it('fires onEnd with wasSubThreshold=true when phase never went active', () => {
      const onEnd = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({ thresholdReached: () => false, onEnd }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.move(P(1, 0), NO_MODS));
      act(() => result.current.end());
      expect((onEnd.mock.calls[0][0] as DragGestureEndCtx).wasSubThreshold).toBe(true);
    });

    it('committed=false when onEnd returns false', () => {
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({ onEnd: () => false, onGestureEnd }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.end());
      expect(onGestureEnd).toHaveBeenCalledWith(false);
    });

    it('end with no active gesture fires onGestureEnd(false) only', () => {
      const onEnd = vi.fn();
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onEnd, onGestureEnd }));
      act(() => result.current.end());
      expect(onEnd).not.toHaveBeenCalled();
      expect(onGestureEnd).toHaveBeenCalledWith(false);
    });

    it('phase resets to idle after end', () => {
      const { result } = renderHook(() => useDragGesture());
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.end());
      expect(result.current.phase).toBe('idle');
      expect(result.current.isActive).toBe(false);
    });

    it('onGestureEnd fires even when onEnd throws (try/finally)', () => {
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({
          onEnd: () => { throw new Error('boom'); },
          onGestureEnd,
        }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      expect(() => act(() => result.current.end())).toThrow('boom');
      expect(onGestureEnd).toHaveBeenCalledWith(false);
      expect(result.current.phase).toBe('idle');
    });
  });

  describe('cancel', () => {
    it('fires onCancel and onGestureEnd(false) on active gesture', () => {
      const onCancel = vi.fn();
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onCancel, onGestureEnd }));
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.cancel());
      expect(onCancel).toHaveBeenCalledOnce();
      expect(onGestureEnd).toHaveBeenCalledWith(false);
      expect(result.current.phase).toBe('idle');
    });

    it('cancel during pending fires onCancel and onGestureEnd(false)', () => {
      const onCancel = vi.fn();
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({ thresholdReached: () => false, onCancel, onGestureEnd }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.cancel());
      expect(onCancel).toHaveBeenCalledOnce();
      const ctx = onCancel.mock.calls[0][0] as DragGestureCtx;
      expect(ctx.phase).toBe('pending');
      expect(onGestureEnd).toHaveBeenCalledWith(false);
    });

    it('cancel with no active gesture fires only onGestureEnd(false)', () => {
      const onCancel = vi.fn();
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onCancel, onGestureEnd }));
      act(() => result.current.cancel());
      expect(onCancel).not.toHaveBeenCalled();
      expect(onGestureEnd).toHaveBeenCalledWith(false);
    });
  });

  describe('restart while active', () => {
    it('silently replaces state — no onCancel, no onEnd, no prior onGestureEnd', () => {
      const onCancel = vi.fn();
      const onEnd = vi.fn();
      const onGestureEnd = vi.fn();
      const onStart = vi.fn();
      const onGestureStart = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({ onCancel, onEnd, onGestureEnd, onStart, onGestureStart }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onGestureStart).toHaveBeenCalledTimes(1);
      act(() => result.current.start(P(50, 50), NO_MODS));
      expect(onCancel).not.toHaveBeenCalled();
      expect(onEnd).not.toHaveBeenCalled();
      expect(onGestureEnd).not.toHaveBeenCalled();
      expect(onStart).toHaveBeenCalledTimes(2);
      expect(onGestureStart).toHaveBeenCalledTimes(2);
      const ctx = onStart.mock.calls[1][0] as DragGestureCtx;
      expect(ctx.start).toEqual(P(50, 50));
    });
  });

  describe('scratch lifecycle', () => {
    it('initScratch builds scratch fresh per gesture', () => {
      const init = vi.fn(() => ({ count: 0 }));
      const { result } = renderHook(() =>
        useDragGesture<{ count: number }>({ initScratch: init }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.end());
      act(() => result.current.start(P(0, 0), NO_MODS));
      expect(init).toHaveBeenCalledTimes(2);
    });

    it('scratch is shared across onStart/onMove/onActivate/onEnd within one gesture', () => {
      const seen: { count: number }[] = [];
      const { result } = renderHook(() =>
        useDragGesture<{ count: number }>({
          initScratch: () => ({ count: 0 }),
          onStart: (ctx) => { ctx.scratch.count += 1; seen.push({ ...ctx.scratch }); },
          onMove: (ctx) => { ctx.scratch.count += 1; seen.push({ ...ctx.scratch }); },
          onEnd: (ctx) => { ctx.scratch.count += 1; seen.push({ ...ctx.scratch }); },
        }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.move(P(5, 5), NO_MODS));
      act(() => result.current.end());
      expect(seen).toEqual([{ count: 1 }, { count: 2 }, { count: 3 }]);
    });
  });

  describe('modifiers', () => {
    it('start captures initial modifiers; move updates them live', () => {
      const ctxs: DragGestureCtx[] = [];
      const { result } = renderHook(() =>
        useDragGesture({
          onStart: (ctx) => ctxs.push({ ...ctx, modifiers: { ...ctx.modifiers } } as DragGestureCtx),
          onMove: (ctx) => ctxs.push({ ...ctx, modifiers: { ...ctx.modifiers } } as DragGestureCtx),
        }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.move(P(5, 5), SHIFT));
      expect(ctxs[0].modifiers.shift).toBe(false);
      expect(ctxs[1].modifiers.shift).toBe(true);
    });
  });

  describe('controller stability', () => {
    it('controller identity stays stable across renders', () => {
      const { result, rerender } = renderHook(() => useDragGesture());
      const c1 = result.current;
      rerender();
      expect(result.current).toBe(c1);
    });

    it('controller methods stay stable across option-callback changes', () => {
      let onMove = vi.fn();
      const { result, rerender } = renderHook(() => useDragGesture({ onMove }));
      const move1 = result.current.move;
      onMove = vi.fn();
      rerender();
      expect(result.current.move).toBe(move1);
    });
  });
});
