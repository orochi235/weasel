import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { tweenVertexColors, springVertexColors, cycleVertexColors, staggerVertexColors } from './colorHelpers';

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

describe('springVertexColors', () => {
  it('settles at the target color and clears the override', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      springVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from: [0, 0, 0, 255],
        to: [255, 128, 64, 255],
        preset: 'stiff',
        onDone,
      });
    });
    act(() => clock.advance(0));
    for (let i = 0; i < 200; i++) {
      act(() => clock.advance(16));
      if (onDone.mock.calls.length > 0) break;
    }
    expect(onDone).toHaveBeenCalled();
    expect(result.current.colorOverrides.get('a', 'fill')).toBeUndefined();
  });

  it('throws on length mismatch', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    expect(() => {
      springVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from: [0, 0, 0, 255],
        to: [0, 0, 0, 255, 0, 0, 0, 255],
      });
    }).toThrow();
  });
});

describe('cycleVertexColors', () => {
  it('registers a function override that rotates colors along the path', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const base = [
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ];
    act(() => {
      cycleVertexColors(result.current, {
        id: 'tri',
        channel: 'stroke',
        msPerCycle: 300,
      });
    });
    const override = result.current.colorOverrides.get('tri', 'stroke');
    expect(typeof override).toBe('function');

    const fn = override as (base: readonly number[], tMs: number) => number[];
    expect(fn(base, 0)).toEqual(base);

    const t100 = fn(base, 100);
    expect(t100.slice(0, 4)).toEqual([0, 255, 0, 255]);
    expect(t100.slice(4, 8)).toEqual([0, 0, 255, 255]);
    expect(t100.slice(8, 12)).toEqual([255, 0, 0, 255]);
  });

  it('cancel() removes the override', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    let handle: { cancel: () => void } | undefined;
    act(() => {
      handle = cycleVertexColors(result.current, {
        id: 'tri',
        channel: 'fill',
        msPerCycle: 1000,
      });
    });
    expect(result.current.colorOverrides.get('tri', 'fill')).toBeDefined();
    act(() => { handle!.cancel(); });
    expect(result.current.colorOverrides.get('tri', 'fill')).toBeUndefined();
  });

  it('direction: -1 rotates the other way', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const base = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255];
    act(() => {
      cycleVertexColors(result.current, {
        id: 'tri',
        channel: 'stroke',
        msPerCycle: 300,
        direction: -1,
      });
    });
    const fn = result.current.colorOverrides.get('tri', 'stroke') as
      (base: readonly number[], tMs: number) => number[];
    const t100 = fn(base, 100);
    expect(t100.slice(0, 4)).toEqual([0, 0, 255, 255]);
  });
});

describe('staggerVertexColors', () => {
  it('transitions anchors from origin outward', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const from = [
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
    ];
    const to = [
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
    ];
    act(() => {
      staggerVertexColors(result.current, {
        id: 'p',
        channel: 'stroke',
        from,
        to,
        anchorMs: 100,
        perAnchorDelay: 50,
        origin: 'first',
        easing: (t) => t,
      });
    });

    const fn = result.current.colorOverrides.get('p', 'stroke') as
      (base: readonly number[], tMs: number) => number[];

    expect(fn(from, 0)).toEqual(from);

    const at50 = fn(from, 50);
    expect(at50.slice(0, 4)).toEqual([128, 128, 128, 255]);
    expect(at50.slice(4, 8)).toEqual([0, 0, 0, 255]);
    expect(at50.slice(8, 12)).toEqual([0, 0, 0, 255]);

    const at300 = fn(from, 300);
    expect(at300).toEqual(to);
  });

  it('fires onDone after the slowest anchor completes and clears the override', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      staggerVertexColors(result.current, {
        id: 'p',
        channel: 'fill',
        from: [0, 0, 0, 255, 0, 0, 0, 255],
        to: [255, 255, 255, 255, 255, 255, 255, 255],
        anchorMs: 100,
        perAnchorDelay: 50,
        onDone,
      });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(200));
    expect(onDone).toHaveBeenCalled();
    expect(result.current.colorOverrides.get('p', 'fill')).toBeUndefined();
  });

  it('origin: "last" reverses the propagation', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const from = [0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255];
    const to = [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255];
    act(() => {
      staggerVertexColors(result.current, {
        id: 'p',
        channel: 'stroke',
        from,
        to,
        anchorMs: 100,
        perAnchorDelay: 50,
        origin: 'last',
        easing: (t) => t,
      });
    });
    const fn = result.current.colorOverrides.get('p', 'stroke') as
      (base: readonly number[], tMs: number) => number[];
    const at50 = fn(from, 50);
    expect(at50.slice(8, 12)).toEqual([128, 128, 128, 255]);
    expect(at50.slice(0, 4)).toEqual([0, 0, 0, 255]);
  });

  it('throws on length mismatch', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    expect(() => {
      staggerVertexColors(result.current, {
        id: 'p',
        channel: 'fill',
        from: [0, 0, 0, 255],
        to: [0, 0, 0, 255, 0, 0, 0, 255],
        anchorMs: 100,
        perAnchorDelay: 50,
      });
    }).toThrow();
  });
});
