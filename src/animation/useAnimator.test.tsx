import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { linear, SPRING_PRESETS } from './easings';

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

describe('useAnimator.spring', () => {
  // Reference SPRING_PRESETS so unused-import lint stays quiet across tasks.
  void SPRING_PRESETS;

  it('settles at to within rest threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const ticks: number[] = [];
    const onDone = vi.fn();
    act(() => {
      result.current.spring<number>({
        from: 0,
        to: 100,
        preset: 'stiff',
        onTick: (v) => ticks.push(v),
        onDone,
      });
    });
    // 5s of 16ms frames is more than enough for "stiff" to settle.
    for (let i = 0; i < 320; i++) act(() => clock.advance(16));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(ticks[ticks.length - 1]).toBeCloseTo(100, 1);
  });

  it('honors explicit stiffness/damping/mass over preset', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      result.current.spring<number>({
        from: 0,
        to: 1,
        stiffness: 500,
        damping: 30,
        mass: 1,
        onTick: () => {},
        onDone,
      });
    });
    for (let i = 0; i < 200; i++) act(() => clock.advance(16));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('throws if T is non-numeric and vector helpers are missing', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    expect(() =>
      result.current.spring({
        from: { x: 0, y: 0 },
        to: { x: 10, y: 10 },
        onTick: () => {},
      } as never),
    ).toThrow(/spring/);
  });
});

describe('useAnimator.decay', () => {
  it('integrates velocity with friction until magnitude < threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const ticks: number[] = [];
    const onDone = vi.fn();
    act(() => {
      result.current.decay<number>({
        from: 0,
        velocity: 600, // px/sec
        friction: 0.9,
        threshold: 1,
        add: (a, b) => a + b,
        scale: (v, k) => v * k,
        magnitude: (v) => Math.abs(v),
        onTick: (v) => ticks.push(v),
        onDone,
      });
    });
    // friction 0.9/sec @ v0=600 → ~4000 frames to drop below 1px/sec
    for (let i = 0; i < 5000; i++) act(() => clock.advance(16));
    expect(onDone).toHaveBeenCalledTimes(1);
    // Last value should be greater than the first (we moved in the +x direction).
    expect(ticks[ticks.length - 1]).toBeGreaterThan(ticks[0]);
  });

  it('skips immediately when initial |velocity| is below threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      result.current.decay<number>({
        from: 0,
        velocity: 0.1,
        threshold: 1,
        add: (a, b) => a + b,
        scale: (v, k) => v * k,
        magnitude: (v) => Math.abs(v),
        onTick: () => {},
        onDone,
      });
    });
    act(() => clock.advance(16));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
