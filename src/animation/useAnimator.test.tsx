import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { linear } from './easings';

/** Minimal manual rAF driver for deterministic tests. */
function makeClock() {
  let now = 0;
  const callbacks = new Map<number, (t: number) => void>();
  let nextHandle = 1;
  const requestFrame = (cb: (t: number) => void): number => {
    const h = nextHandle++;
    callbacks.set(h, cb);
    return h;
  };
  const cancelFrame = (h: number): void => {
    callbacks.delete(h);
  };
  const advance = (deltaMs: number) => {
    now += deltaMs;
    const due = Array.from(callbacks.entries());
    callbacks.clear();
    for (const [, cb] of due) cb(now);
  };
  return { now: () => now, requestFrame, cancelFrame, advance };
}

describe('useAnimator.tween', () => {
  it('ticks linear values across the duration', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const ticks: number[] = [];
    act(() => {
      result.current.tween<number>({
        from: 0,
        to: 100,
        ms: 1000,
        easing: linear,
        onTick: (v) => ticks.push(v),
      });
    });
    act(() => clock.advance(0));     // first frame at t=0 → value 0
    act(() => clock.advance(500));   // halfway → 50
    act(() => clock.advance(500));   // done → 100
    expect(ticks[0]).toBeCloseTo(0, 6);
    expect(ticks[ticks.length - 1]).toBeCloseTo(100, 6);
    expect(ticks.some((v) => Math.abs(v - 50) < 0.5)).toBe(true);
  });

  it('calls onDone exactly once and isActive returns false after', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      result.current.tween({ from: 0, to: 1, ms: 100, onTick: () => {}, onDone });
    });
    act(() => clock.advance(0));
    expect(result.current.isActive()).toBe(true);
    act(() => clock.advance(100));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.isActive()).toBe(false);
  });

  it('cancel() stops further ticks and skips onDone', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onTick = vi.fn();
    const onDone = vi.fn();
    let handle!: ReturnType<typeof result.current.tween>;
    act(() => {
      handle = result.current.tween({ from: 0, to: 1, ms: 1000, onTick, onDone });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    const before = onTick.mock.calls.length;
    act(() => handle.cancel());
    act(() => clock.advance(500));
    expect(onTick.mock.calls.length).toBe(before);
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.isActive()).toBe(false);
  });

  it('cancelKey collisions cancel the prior animation', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const firstDone = vi.fn();
    const secondDone = vi.fn();
    act(() => {
      result.current.tween({ from: 0, to: 1, ms: 1000, cancelKey: 'k', onTick: () => {}, onDone: firstDone });
    });
    act(() => clock.advance(0));
    act(() => {
      result.current.tween({ from: 0, to: 1, ms: 100, cancelKey: 'k', onTick: () => {}, onDone: secondDone });
    });
    act(() => clock.advance(100));
    expect(firstDone).not.toHaveBeenCalled();
    expect(secondDone).toHaveBeenCalledTimes(1);
  });

  it('rAF stops when no animations remain (no requestFrame after settle)', () => {
    const clock = makeClock();
    const requestSpy = vi.fn(clock.requestFrame);
    const { result } = renderHook(() =>
      useAnimator({ now: clock.now, requestFrame: requestSpy, cancelFrame: clock.cancelFrame }),
    );
    act(() => {
      result.current.tween({ from: 0, to: 1, ms: 100, onTick: () => {} });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    const callsAfterSettle = requestSpy.mock.calls.length;
    act(() => clock.advance(1000));
    expect(requestSpy.mock.calls.length).toBe(callsAfterSettle);
  });
});
