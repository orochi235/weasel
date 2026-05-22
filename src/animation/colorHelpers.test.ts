import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { tweenVertexColors } from './colorHelpers';

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => {
      now += dt;
      const due = Array.from(cbs.values());
      cbs.clear();
      for (const cb of due) cb(now);
    },
  };
}

describe('tweenVertexColors', () => {
  it('writes interpolated colors to the registry each tick (rgb space)', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const from = [255, 0, 0, 255];
    const to = [0, 255, 0, 255];
    act(() => {
      tweenVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from,
        to,
        ms: 100,
        easing: (t) => t,
      });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(50));
    const mid = result.current.colorOverrides.get('a', 'fill') as number[];
    expect(mid).toEqual([128, 128, 0, 255]);
  });

  it('clears the override and fires onDone when complete', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      tweenVertexColors(result.current, {
        id: 'a',
        channel: 'stroke',
        from: [0, 0, 0, 255],
        to: [255, 255, 255, 255],
        ms: 100,
        onDone,
      });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    expect(onDone).toHaveBeenCalledOnce();
    expect(result.current.colorOverrides.get('a', 'stroke')).toBeUndefined();
  });

  it('throws on from/to length mismatch', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    expect(() => {
      tweenVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from: [0, 0, 0, 255],
        to: [0, 0, 0, 255, 0, 0, 0, 255],
        ms: 100,
      });
    }).toThrow();
  });

  it('uses oklab space when requested (red→green midpoint is not gray)', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    act(() => {
      tweenVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from: [255, 0, 0, 255],
        to: [0, 255, 0, 255],
        ms: 100,
        easing: (t) => t,
        interpolation: 'oklab',
      });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(50));
    const mid = result.current.colorOverrides.get('a', 'fill') as number[];
    expect(mid).not.toEqual([128, 128, 0, 255]);
  });

  it('uses custom interpolate when provided (overrides interpolation option)', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const custom = vi.fn((_a: readonly number[], _b: readonly number[], _t: number) =>
      [42, 42, 42, 42],
    );
    act(() => {
      tweenVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from: [0, 0, 0, 0],
        to: [255, 255, 255, 255],
        ms: 100,
        interpolation: 'oklab',
        interpolate: custom,
      });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(50));
    expect(custom).toHaveBeenCalled();
    expect(result.current.colorOverrides.get('a', 'fill')).toEqual([42, 42, 42, 42]);
  });
});
