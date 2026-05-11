import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '../useAnimator';
import { animateOnSetPose } from './animateOnSetPose';
import type { Op } from 'core/ops/types';

interface RectPose { x: number; y: number; width: number; height: number }
function makeAdapter(initial: Map<string, RectPose>) {
  const setPose = vi.fn((id: string, pose: RectPose) => initial.set(id, pose));
  const applyBatch = vi.fn((_ops: Op[], _label: string) => {});
  return {
    base: {
      getNodes: () => [],
      getNode: (id: string) => (initial.has(id) ? { id } : undefined),
      getSelection: () => [],
      hitTest: () => null,
      getPose: (id: string) => initial.get(id)!,
      getParent: () => null,
      setPose,
      setParent: () => {},
      insertNode: () => {},
      removeNode: () => {},
      setSelection: () => {},
      applyBatch,
    },
    setPose,
    applyBatch,
  };
}

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

describe('animateOnSetPose', () => {
  it('intercepts setPose and tweens to the target', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { base, setPose } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateOnSetPose(base as never, result.current, { ms: 100 });
    act(() => {
      wrapped.setPose('a', { x: 100, y: 0, width: 10, height: 10 });
    });
    // The wrapper must NOT immediately call base.setPose with the destination.
    const directCalls = setPose.mock.calls.filter((c) => c[1].x === 100);
    expect(directCalls.length).toBe(0);
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    const last = setPose.mock.calls[setPose.mock.calls.length - 1][1];
    expect(last.x).toBeCloseTo(100, 1);
  });

  it('records exactly one transform op for the animation', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { base, applyBatch } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateOnSetPose(base as never, result.current, { ms: 50 });
    act(() => {
      wrapped.setPose('a', { x: 50, y: 0, width: 10, height: 10 });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(50));
    expect(applyBatch).toHaveBeenCalledTimes(1);
  });

  it('writes through directly when a tween is already in flight for the same id', () => {
    // Regression: under momentum decay, the wrapper used to spawn a fresh
    // 250ms tween every rAF tick (~60/sec), each immediately cancelled by the
    // next frame's call. That stackup caused the AnimationDemo GL backend to
    // crash after a single high-velocity drag (the wrap-tween's t=0 sample
    // fights the decay's onTick, and the cycle of register/cancel overwhelms
    // the renderer process). The fix: when a tween for this id is already
    // active, the second setPose writes through to the base adapter, leaving
    // the in-flight tween to finish naturally.
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { base, setPose, applyBatch } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateOnSetPose(base as never, result.current, { ms: 100 });
    // First call: starts a tween. applyBatch records exactly one op for it.
    act(() => {
      wrapped.setPose('a', { x: 100, y: 0, width: 10, height: 10 });
    });
    expect(applyBatch).toHaveBeenCalledTimes(1);
    expect(result.current.isActive('pose:a')).toBe(true);
    setPose.mockClear();
    applyBatch.mockClear();

    // Second call (mid-tween): writes through. No new tween, no new op.
    act(() => {
      wrapped.setPose('a', { x: 110, y: 0, width: 10, height: 10 });
    });
    expect(setPose).toHaveBeenCalledTimes(1);
    expect(setPose).toHaveBeenCalledWith('a', { x: 110, y: 0, width: 10, height: 10 });
    expect(applyBatch).not.toHaveBeenCalled();
  });

  it('writes through when called from inside another animation tick (no wrap-tween storm)', () => {
    // Regression: even with the same-id-isActive guard above, after a
    // wrap-tween's 250ms completed, the next momentum-decay onTick (16ms
    // later) would start a NEW wrap-tween, and 250ms after that another,
    // ad infinitum. Visible to the user as "flicked cards never stop —
    // they pause briefly every 250ms then continue moving until offscreen."
    // The fix: detect via animator.isTicking() that the caller is itself an
    // animator tick (decay's onTick, etc.) and write through directly,
    // regardless of whether a wrap-tween is currently in flight.
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { base, setPose, applyBatch } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateOnSetPose(base as never, result.current, { ms: 100 });

    // Schedule a decay that calls wrapped.setPose from its onTick — same
    // pattern as momentum-driven movement.
    const writes: number[] = [];
    act(() => {
      result.current.decay<number>({
        from: 0,
        velocity: 50,
        threshold: 0.5,
        add: (a, b) => a + b,
        scale: (v, k) => v * k,
        magnitude: (v) => Math.abs(v),
        onTick: (x) => {
          writes.push(x);
          // This is the re-entrant call. Without the isTicking() guard,
          // each call would spawn a fresh tween → 1 + N applyBatch calls.
          wrapped.setPose('a', { x, y: 0, width: 10, height: 10 });
        },
      });
    });
    // Drive the decay loop for several frames.
    for (let i = 0; i < 5; i++) act(() => clock.advance(16));
    // Decay should have ticked at least a few times.
    expect(writes.length).toBeGreaterThan(0);
    // CRITICAL: zero applyBatch calls — every wrapped.setPose during the
    // decay's onTick wrote through to base directly.
    expect(applyBatch).not.toHaveBeenCalled();
    // setPose on the base adapter should equal the number of decay ticks.
    expect(setPose.mock.calls.length).toBe(writes.length);
  });

  it('shouldAnimate returning false writes through immediately and emits no op', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { base, setPose, applyBatch } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateOnSetPose(base as never, result.current, {
      ms: 100,
      shouldAnimate: () => false,
    });
    act(() => {
      wrapped.setPose('a', { x: 7, y: 0, width: 10, height: 10 });
    });
    expect(setPose).toHaveBeenCalledWith('a', { x: 7, y: 0, width: 10, height: 10 });
    expect(applyBatch).not.toHaveBeenCalled();
  });
});
