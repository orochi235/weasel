import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimator } from '../useAnimator';
import { momentum } from './momentum';
import type { GestureContext } from 'interactions/gestures/types';

interface RectPose { x: number; y: number; width: number; height: number }

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => { now += dt; const due = [...cbs.values()]; cbs.clear(); for (const cb of due) cb(now); },
  };
}

function makeCtx(initialPose: RectPose, setPose: (id: string, p: RectPose) => void): GestureContext<RectPose> {
  return {
    draggedIds: ['a'],
    origin: new Map([['a', { ...initialPose }]]),
    current: new Map([['a', { ...initialPose }]]),
    snap: null,
    modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    adapter: {
      getNode: () => ({ id: 'a' }),
      getNodes: () => [{ id: 'a' }],
      getPose: () => initialPose,
      getParent: () => null,
      setPose: (id: string, p: RectPose) => { setPose(id, p); },
      setParent: () => {},
    },
    scratch: {},
  };
}

describe('momentum', () => {
  it('records pointer samples on each onMove', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const beh = momentum<RectPose>({ animator: result.current });
    const setPose = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    beh.onStart?.(ctx);
    ctx.pointer = { worldX: 10, worldY: 0, clientX: 10, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    ctx.pointer = { worldX: 20, worldY: 0, clientX: 20, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    expect(ctx.scratch['momentum.samples']).toBeDefined();
  });

  it('suppresses default commit and fires decay when release velocity exceeds threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const decaySpy = vi.spyOn(result.current, 'decay');
    const beh = momentum<RectPose>({ animator: result.current, threshold: 0, now: clock.now });
    const setPose = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    beh.onStart?.(ctx);
    // Two samples 16ms apart at +10px each → ~625 px/sec
    ctx.pointer = { worldX: 0, worldY: 0, clientX: 0, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    clock.advance(16);
    ctx.pointer = { worldX: 10, worldY: 0, clientX: 10, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    clock.advance(16);
    ctx.pointer = { worldX: 20, worldY: 0, clientX: 20, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    const ops = beh.onEnd?.(ctx);
    expect(ops).toBeNull(); // suppress default commit
    expect(decaySpy).toHaveBeenCalledTimes(1);
  });

  it('returns undefined (defer to default) when release velocity is below threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const decaySpy = vi.spyOn(result.current, 'decay');
    const beh = momentum<RectPose>({ animator: result.current, threshold: 10000 });
    const setPose = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    beh.onStart?.(ctx);
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    const ops = beh.onEnd?.(ctx);
    expect(ops).toBeUndefined();
    expect(decaySpy).not.toHaveBeenCalled();
  });
  it('clamps the per-tick position to bounds and stops on edge hit', () => {
    // Regression: without bounds, a hard flick carries the card thousands
    // of pixels offscreen before friction settles velocity. With bounds and
    // policy='stop', the decay cancels as soon as the clamped position
    // pegs the boundary on every dragged id.
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const setPose = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    const beh = momentum<RectPose>({
      animator: result.current,
      friction: 0.9,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      now: clock.now,
    });
    beh.onStart?.(ctx);
    // Three samples 50ms apart, 50px right each → vx = 1000 px/s with both
    // a sample at the cutoff boundary and one at the latest moment for the
    // velocity calculation to compute a non-zero dt.
    clock.advance(50);
    ctx.pointer = { worldX: 50, worldY: 0, clientX: 50, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    clock.advance(50);
    ctx.pointer = { worldX: 100, worldY: 0, clientX: 100, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    const ops = beh.onEnd?.(ctx);
    // onEnd should have suppressed the default commit (returned null) and
    // queued a decay that calls setPose ≥ once on its first tick.
    expect(ops).toBeNull();
    // Drive frames so the decay ticks.
    for (let i = 0; i < 20; i++) clock.advance(16);
    // Some setPose calls happened; the final position is clamped at x ≤ 100.
    expect(setPose.mock.calls.length).toBeGreaterThan(0);
    const lastCall = setPose.mock.calls[setPose.mock.calls.length - 1];
    const finalPose = lastCall[1] as RectPose;
    expect(finalPose.x).toBeLessThanOrEqual(100);
    // Decay cancelled or finished — no animations active.
    expect(result.current.isActive()).toBe(false);
  });
});
