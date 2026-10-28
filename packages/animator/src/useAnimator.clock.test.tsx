import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createClock, holdAt } from '@weasel-js/clock';
import { linear } from '@weasel-js/geom';
import { useAnimator } from './useAnimator';

/** An animator on a clock synced by hand, and its own frame loop's queue, flushed by hand. */
function setup(rate = 1) {
  const handle = createClock({ rate });
  const queued: ((t: number) => void)[] = [];
  let wall = 0;
  const { result } = renderHook(() => useAnimator({
    clock: handle,
    requestFrame: (cb) => { queued.push(cb); return queued.length; },
    cancelFrame: () => {},
  }));
  act(() => { handle.clock.sync(wall); });
  return {
    animator: result.current,
    handle,
    /** `ms` of wall time: the clock syncs, then any frame the animator asked for runs. */
    step: (ms: number) => act(() => {
      wall += ms;
      handle.clock.sync(wall);
      for (const cb of queued.splice(0)) cb(wall);
    }),
    pending: () => queued.length,
  };
}

function tweenOn(animator: ReturnType<typeof useAnimator>) {
  let value = Number.NaN;
  let done = false;
  act(() => {
    animator.tween({
      from: 0, to: 100, ms: 1000, easing: linear,
      onTick: (v) => { value = v; }, onDone: () => { done = true; },
    });
  });
  return { value: () => value, done: () => done };
}

describe('useAnimator on a clock', () => {
  it('advances as the clock moves, at its rate', () => {
    const { animator, step } = setup(2);
    const tw = tweenOn(animator);
    step(0);
    step(100);
    expect(tw.value()).toBeCloseTo(20);
    step(400);
    expect(tw.done()).toBe(true);
    expect(tw.value()).toBe(100);
  });

  it('holds still while the clock is paused', () => {
    const { animator, handle, step } = setup();
    const tw = tweenOn(animator);
    step(0);
    step(300);
    act(() => { handle.clock.rate = 0; });
    step(500);
    step(500);
    expect(tw.value()).toBeCloseTo(30);
    act(() => { handle.clock.rate = 1; });
    step(0);
    step(100);
    expect(tw.value()).toBeCloseTo(40);
  });

  it('runs no frame loop of its own while the clock moves', () => {
    const { animator, step, pending } = setup();
    tweenOn(animator);
    step(0);
    step(16);
    step(16);
    expect(pending()).toBe(0);
  });

  it('lands where a seek back puts it, and plays on forward from there', () => {
    const { animator, handle, step } = setup();
    const tw = tweenOn(animator);
    step(0);
    step(600);
    expect(tw.value()).toBeCloseTo(60);
    act(() => { handle.clock.seek(handle.clock.elapsed - 300); });
    step(0);
    expect(tw.value()).toBeCloseTo(30);
    step(200);
    expect(tw.value()).toBeCloseTo(50);
  });

  it('is paused and placed by holdAt on its clock', () => {
    const { animator, handle, step } = setup();
    const tw = tweenOn(animator);
    step(0);
    step(500);
    act(() => { holdAt(handle, handle.clock.elapsed - 250); });
    step(16);
    expect(tw.value()).toBeCloseTo(25);
    step(500);
    expect(tw.value()).toBeCloseTo(25);
  });

  it('plays backward on a negative rate, and ends a tween back at its start', () => {
    const { animator, handle, step } = setup();
    const tw = tweenOn(animator);
    step(0);
    step(400);
    act(() => { handle.clock.rate = -1; });
    step(100);
    expect(tw.value()).toBeCloseTo(30);
    step(400);
    expect(tw.value()).toBe(0);
    expect(tw.done()).toBe(true);
  });
});
