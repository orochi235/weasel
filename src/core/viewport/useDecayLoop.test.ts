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
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({ velocity: { vx: 0.001, vy: 0 }, friction: 0.5, minSpeed: 0.01, onTick });
    });
    // First frame: velocity 0.001 < minSpeed 0.01 → should stop immediately
    act(() => { stepRAF(16); });
    expect(onTick).not.toHaveBeenCalled();
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
        friction: 1,                     // no friction — keeps constant velocity
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
        friction: 1,                     // no friction
        minSpeed: 0.001,
        viewBounds: { minX: -5 },        // wall at x = -5, starting at x = 0
        boundary: 'bounce',
        initialPosition: { x: 0, y: 0 },
        onTick: (dx) => { ticks.push(dx); },
      });
    });
    act(() => { stepRAF(1); });  // first frame: skip
    act(() => { stepRAF(1); });  // second frame: hits minX, bounces
    act(() => { stepRAF(1); });  // third frame: moving right (reflected)
    // First tick clamped to -5 (from 0 to minX)
    expect(ticks[0]).toBeCloseTo(-5);
    // After bounce, velocity is positive — next tick moves right
    expect(ticks[1]).toBeGreaterThan(0);
  });

  it('boundary:spring reflects with damping (smaller magnitude on rebound)', () => {
    const ticks: number[] = [];
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({
        velocity: { vx: -10, vy: 0 },
        friction: 1,                     // no friction — isolate spring damping
        minSpeed: 0.001,
        viewBounds: { minX: -5 },
        boundary: 'spring',
        initialPosition: { x: 0, y: 0 },
        onTick: (dx) => { ticks.push(dx); },
      });
    });
    act(() => { stepRAF(1); });  // first frame: skip (records lastTime)
    act(() => { stepRAF(1); });  // hits minX, velocity reflects with damping
    act(() => { stepRAF(1); });  // rebound tick — should be smaller magnitude
    // First tick clamped at -5 (full pre-bounce travel)
    expect(ticks[0]).toBeCloseTo(-5);
    // Rebound is positive (reflected) but magnitude is less than incoming
    expect(ticks[1]).toBeGreaterThan(0);
    expect(Math.abs(ticks[1])).toBeLessThan(Math.abs(ticks[0]));
  });

  it('boundary:spring eventually settles below minSpeed', () => {
    const ticks: number[] = [];
    const onEnd = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({
        velocity: { vx: -2, vy: 0 },
        friction: 1,                     // no friction — only spring damping shrinks velocity
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
        friction: 1,
        minSpeed: 0.001,
        viewBounds: { minX: -100, maxX: 5 },
        boundary: 'spring',
        initialPosition: { x: 0, y: 0 },
        onTick: (dx) => { ticks.push(dx); },
      });
    });
    act(() => { stepRAF(1); });  // first frame: skip
    act(() => { stepRAF(1); });  // hits maxX, reflects left with damping
    act(() => { stepRAF(1); });  // moving left now
    expect(ticks[0]).toBeCloseTo(5);   // clamped at maxX
    expect(ticks[1]).toBeLessThan(0);  // reflected leftward
    expect(Math.abs(ticks[1])).toBeLessThan(Math.abs(ticks[0]));
  });
});
