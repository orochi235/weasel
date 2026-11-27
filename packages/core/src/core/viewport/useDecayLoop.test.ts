import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDecayLoop } from './useDecayLoop';

// RAF fake: collect callbacks and step them manually
let rafCallbacks: Array<(t: number) => void> = [];
let rafTime = 0;

function stepRAF(dt = 16) {
  rafTime += dt;
  const cbs = rafCallbacks.splice(0);
  for (const cb of cbs) cb(rafTime);
}

beforeEach(() => {
  rafCallbacks = [];
  rafTime = 0;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
    rafCallbacks[id - 1] = () => {};
  });
});

afterEach(() => { vi.restoreAllMocks(); });

describe('useDecayLoop', () => {
  it.each([NaN, Infinity, -Infinity])('ends at once, without a tick, on a velocity of %s', (bad) => {
    const onTick = vi.fn();
    const onEnd = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => { result.current.start({ velocity: { vx: bad, vy: 0 }, onTick, onEnd }); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    act(() => { stepRAF(16); });
    act(() => { stepRAF(16); });
    expect(onTick).not.toHaveBeenCalled();
    expect(rafCallbacks).toHaveLength(0);
  });

  it('calls onTick with decaying deltas each frame', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({ velocity: { vx: 1, vy: 0 }, friction: 0.9, minSpeed: 0.001, onTick });
    });
    act(() => { stepRAF(16); });  // first frame skipped (records lastTime)
    act(() => { stepRAF(16); });
    act(() => { stepRAF(16); });
    expect(onTick).toHaveBeenCalledTimes(2);
    const [[dx1], [dx2]] = onTick.mock.calls;
    expect(dx1).toBeGreaterThan(dx2);  // velocity decaying
    expect(dx1).toBeGreaterThan(0);
  });

  it('stops calling onTick when speed drops below minSpeed', () => {
    const onTick = vi.fn();
    const onEnd = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({ velocity: { vx: 1, vy: 0 }, friction: 0.5, minSpeed: 0.3, onTick, onEnd });
    });
    // Speed roughly halves per frame: 1 → 0.51 → 0.26. The frame it falls below 0.3 still moves
    // the view as far as the coast went, then ends.
    for (let i = 0; i < 6; i++) act(() => { stepRAF(16); });
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('cancel() stops the loop', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({ velocity: { vx: 1, vy: 0 }, friction: 0.9, minSpeed: 0.001, onTick });
    });
    act(() => { stepRAF(16); });  // first frame skipped (records lastTime)
    act(() => { stepRAF(16); });  // first real tick
    act(() => { result.current.cancel(); });
    act(() => { stepRAF(16); });
    expect(onTick).toHaveBeenCalledTimes(1);  // only the first real frame
  });

  it('calls onEnd when initial speed is below minSpeed', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({ velocity: { vx: 0.001, vy: 0 }, friction: 0.5, minSpeed: 0.01, onTick: () => {}, onEnd });
    });
    act(() => { stepRAF(16); });
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('start() replaces an in-flight loop', () => {
    const onTick1 = vi.fn();
    const onTick2 = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({ velocity: { vx: 1, vy: 0 }, friction: 0.9, minSpeed: 0.001, onTick: onTick1 });
    });
    act(() => { stepRAF(16); });  // first loop: first frame skipped
    act(() => { stepRAF(16); });  // first loop ticks once
    act(() => {
      result.current.start({ velocity: { vx: 1, vy: 0 }, friction: 0.9, minSpeed: 0.001, onTick: onTick2 });
    });
    act(() => { stepRAF(16); });  // second loop's first frame (skipped - sets lastTime)
    act(() => { stepRAF(16); });  // second loop ticks
    expect(onTick1).toHaveBeenCalledTimes(1);  // first loop stopped
    expect(onTick2).toHaveBeenCalledTimes(1);  // second loop running
  });

  it('boundary:stop zeroes velocity component when position hits a bound', () => {
    const ticks: number[] = [];
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({
        velocity: { vx: -10, vy: 0 },  // moving left
        friction: 0.999999,                     // next to no friction — keeps constant velocity
        minSpeed: 0.001,
        viewBounds: { minX: -5 },        // wall at x = -5, starting at x = 0
        boundary: 'stop',
        initialPosition: { x: 0, y: 0 },
        onTick: (dx) => { ticks.push(dx); },
      });
    });
    act(() => { stepRAF(1); });  // first frame: skip (sets lastTime)
    act(() => { stepRAF(1); });  // second frame: x moves to -10, clamped to -5
    act(() => { stepRAF(1); });  // third frame: vx=0, no movement
    // First tick clamped to -5 (not -10)
    expect(ticks[0]).toBeCloseTo(-5);
    // Velocity zeroed → speed < minSpeed → loop terminates after one tick
    expect(ticks.length).toBe(1);
  });

  it('boundary:bounce reflects velocity component on bound hit', () => {
    const ticks: number[] = [];
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({
        velocity: { vx: -10, vy: 0 },  // moving left
        friction: 0.999999,                     // next to no friction
        minSpeed: 0.001,
        viewBounds: { minX: -8 },        // wall at x = -8, starting at x = 0
        boundary: 'bounce',
        initialPosition: { x: 0, y: 0 },
        onTick: (dx) => { ticks.push(dx); },
      });
    });
    act(() => { stepRAF(1); });  // first frame: skip
    act(() => { stepRAF(1); });  // second frame: meets minX at 0.8 ms, bounces
    act(() => { stepRAF(1); });  // third frame: moving right (reflected)
    // 8 to the wall, then 2 back off it in the rest of the frame, at full speed.
    expect(ticks[0]).toBeCloseTo(-6);
    expect(ticks[1]).toBeCloseTo(10);
  });

  it('bounces to the same place whatever the frame rate', () => {
    const run = (frames: number, dt: number) => {
      let x = 0;
      const { result } = renderHook(() => useDecayLoop());
      act(() => {
        result.current.start({
          velocity: { vx: -10, vy: 3 },
          friction: 0.92,
          minSpeed: 0.001,
          viewBounds: { minX: -50, maxX: 50, minY: -20, maxY: 20 },
          boundary: 'spring',
          initialPosition: { x: 0, y: 0 },
          onTick: (dx) => { x += dx; },
        });
      });
      act(() => { stepRAF(dt); });  // first frame: skip
      for (let i = 0; i < frames; i++) act(() => { stepRAF(dt); });
      result.current.cancel();
      return x;
    };
    expect(run(120, 2)).toBeCloseTo(run(15, 16), 6);
  });

  it('boundary:spring reflects with damping (smaller magnitude on rebound)', () => {
    const ticks: number[] = [];
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({
        velocity: { vx: -10, vy: 0 },
        friction: 0.999999,                     // next to no friction — isolate spring damping
        minSpeed: 0.001,
        viewBounds: { minX: -8 },        // wall farther than damped rebound (5)
        boundary: 'spring',
        initialPosition: { x: 0, y: 0 },
        onTick: (dx) => { ticks.push(dx); },
      });
    });
    act(() => { stepRAF(1); });  // first frame: skip (records the start)
    act(() => { stepRAF(1); });  // meets minX at 0.8 ms, velocity reflects with damping
    act(() => { stepRAF(1); });  // rebound tick — should be smaller magnitude
    // 8 to the wall, then 0.2 ms back off it at half speed.
    expect(ticks[0]).toBeCloseTo(-7);
    // The rebound keeps half the speed: |vx| * 0.5 = 5 over dt = 1 ms.
    expect(ticks[1]).toBeCloseTo(5);
  });

  it('boundary:spring eventually settles below minSpeed', () => {
    const ticks: number[] = [];
    const onEnd = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({
        velocity: { vx: -2, vy: 0 },
        friction: 0.999999,                     // next to no friction — only spring damping shrinks velocity
        minSpeed: 0.5,                   // high threshold so settle is reached quickly
        viewBounds: { minX: -1, maxX: 1 },
        boundary: 'spring',
        initialPosition: { x: 0, y: 0 },
        onTick: (dx) => { ticks.push(dx); },
        onEnd,
      });
    });
    // Step plenty of frames; with damping 0.5 the speed halves each wall hit
    // (|v| = 2 -> 1 -> 0.5; next would be 0.25 which is below minSpeed 0.5).
    for (let i = 0; i < 50; i++) act(() => { stepRAF(1); });
    expect(onEnd).toHaveBeenCalled();
  });

  it('boundary:spring with two-sided bounds reflects on both walls', () => {
    const ticks: number[] = [];
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({
        velocity: { vx: 10, vy: 0 },     // moving right
        friction: 0.999999,
        minSpeed: 0.001,
        viewBounds: { minX: -100, maxX: 8 }, // wall farther than damped rebound (5)
        boundary: 'spring',
        initialPosition: { x: 0, y: 0 },
        onTick: (dx) => { ticks.push(dx); },
      });
    });
    act(() => { stepRAF(1); });  // first frame: skip
    act(() => { stepRAF(1); });  // hits maxX, reflects left with damping
    act(() => { stepRAF(1); });  // moving left now
    expect(ticks[0]).toBeCloseTo(7);   // 8 to maxX, 1 back off it
    expect(ticks[1]).toBeCloseTo(-5);  // reflected leftward at half speed
  });

  it('springs a coast let go past an edge back to it', () => {
    let x = -20;
    const onEnd = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({
        velocity: { vx: 0.01, vy: 0 },   // heading in, but not fast enough to coast 10 back
        minSpeed: 0.0001,
        viewBounds: { minX: -10 },
        boundary: 'stop',
        initialPosition: { x, y: 0 },
        onTick: (dx) => { x += dx; },
        onEnd,
      });
    });
    for (let i = 0; i < 200; i++) act(() => { stepRAF(16); });
    expect(onEnd).toHaveBeenCalledOnce();
    expect(x).toBeCloseTo(-10, 1);
  });

  it('refuses a friction outside (0, 1) or a minSpeed that is not positive, which never come to rest', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    for (const friction of [1, 1.5, 0, -0.5, NaN]) {
      expect(() => result.current.start({ velocity: { vx: 1, vy: 0 }, friction, onTick })).toThrow(RangeError);
    }
    for (const minSpeed of [0, -1, NaN]) {
      expect(() => result.current.start({ velocity: { vx: 1, vy: 0 }, minSpeed, onTick })).toThrow(RangeError);
    }
    act(() => { stepRAF(16); });
    expect(onTick).not.toHaveBeenCalled();
  });

  it.each(['stop', 'bounce', 'spring'] as const)(
    'boundary:%s lets a coast that starts past a bound move freely back in, without jumping to it',
    (boundary) => {
      const ticks: number[] = [];
      const { result } = renderHook(() => useDecayLoop());
      act(() => {
        result.current.start({
          velocity: { vx: 1, vy: 0 },        // moving right, back toward the bounds
          friction: 0.999999,
          minSpeed: 0.001,
          viewBounds: { minX: 0, maxX: 100 },
          boundary,
          initialPosition: { x: -50, y: 0 },  // starts outside, left of minX
          onTick: (dx) => { ticks.push(dx); },
        });
      });
      act(() => { stepRAF(1); });
      act(() => { stepRAF(1); });
      act(() => { stepRAF(1); });
      expect(ticks).toHaveLength(2);
      expect(ticks[0]).toBeCloseTo(1);
      expect(ticks[1]).toBeCloseTo(1);
    },
  );

  it('checks bounds against the live position when given a position reader', () => {
    const ticks: number[] = [];
    let x = 0;
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({
        velocity: { vx: 1, vy: 0 },
        friction: 0.999999,
        minSpeed: 0.001,
        viewBounds: { maxX: 10 },
        boundary: 'stop',
        position: () => ({ x, y: 0 }),
        onTick: (dx) => { x += dx; ticks.push(dx); },
      });
    });
    act(() => { stepRAF(1); });
    act(() => { stepRAF(1); });  // x: 0 -> 1
    x = 9.5;                     // something else moves the view mid-coast
    act(() => { stepRAF(1); });  // the coast picks up from 9.5
    act(() => { stepRAF(1); });  // a full step would reach 10.5; stops at 10
    expect(ticks[0]).toBeCloseTo(1);
    expect(ticks[1]).toBeCloseTo(0.5);
    expect(x).toBeCloseTo(10);
  });

  it('refuses viewBounds with a boundary but no position to check them from', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    expect(() => result.current.start({
      velocity: { vx: 1, vy: 0 }, viewBounds: { minX: 0 }, boundary: 'stop', onTick,
    })).toThrow(TypeError);
    act(() => { stepRAF(16); });
    expect(onTick).not.toHaveBeenCalled();
  });

  it('calls the onEnd of a coast that cancel, a new start, or an unmount cuts short', () => {
    const { result, unmount } = renderHook(() => useDecayLoop());
    const fling = (onEnd: () => void) => act(() => {
      result.current.start({ velocity: { vx: 1, vy: 0 }, friction: 0.9, minSpeed: 0.001, onTick: () => {}, onEnd });
    });
    const canceled = vi.fn();
    fling(canceled);
    act(() => { result.current.cancel(); });
    expect(canceled).toHaveBeenCalledExactlyOnceWith('cancel');
    const replaced = vi.fn();
    fling(replaced);
    fling(() => {});
    expect(replaced).toHaveBeenCalledExactlyOnceWith('cancel');
    const unmounted = vi.fn();
    fling(unmounted);
    unmount();
    expect(unmounted).toHaveBeenCalledExactlyOnceWith('cancel');
  });

  it('compares minSpeed to the velocity times speedScale, so a coast lasts as long on screen at any zoom', () => {
    const ticksAt = (zoom: number) => {
      const onTick = vi.fn();
      const { result } = renderHook(() => useDecayLoop());
      act(() => {
        result.current.start({
          velocity: { vx: 1 / zoom, vy: 0 }, friction: 0.5, minSpeed: 0.1, speedScale: { x: zoom, y: zoom }, onTick,
        });
      });
      for (let i = 0; i < 12; i++) act(() => { stepRAF(16); });
      return onTick.mock.calls.length;
    };
    expect(ticksAt(4)).toBe(ticksAt(1));
    expect(ticksAt(0.25)).toBe(ticksAt(1));
  });
});
