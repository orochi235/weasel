import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { useAnimator } from './useAnimator';
import { createTarget } from './target';

function setup() {
  let now = 0;
  const callbacks = new Map<number, (t: number) => void>();
  let next = 1;
  const clock = {
    now: () => now,
    requestFrame: (cb: (t: number) => void): number => { callbacks.set(next, cb); return next++; },
    cancelFrame: (h: number): void => { callbacks.delete(h); },
  };
  const step = (ms: number) => act(() => {
    now += ms;
    const due = Array.from(callbacks.values());
    callbacks.clear();
    for (const cb of due) cb(now);
  });
  const { result } = renderHook(() => useAnimator(clock));
  let committed = 10;
  const target = createTarget<number>({ get: () => committed, set: (v) => { committed = v; } });
  return { animator: result.current, step, target };
}

describe('a time scale below 0', () => {
  it('is refused on the animator, on a handle, and by key, where it is set', () => {
    const { animator, step, target } = setup();
    let tw!: ReturnType<typeof animator.tween>;
    act(() => { tw = animator.tween({ target, to: 50, ms: 1000, easing: linear, cancelKey: 'k' }); });
    step(0);
    step(300);
    expect(() => animator.setTimeScale(-1)).toThrow(/time scale/);
    expect(() => tw.setTimeScale(-0.5)).toThrow(/time scale/);
    expect(() => animator.setTimeScaleByKey('k', -1)).toThrow(/time scale/);
    expect(() => animator.setTimeScale(Number.NaN)).toThrow(/time scale/);
    // Refused, so the tween plays on as it was.
    step(200);
    expect(target.read()).toBeCloseTo(30, 6);
    expect(animator.timeScale()).toBe(1);
    expect(tw.timeScale()).toBe(1);
  });

  it('takes 0, which holds every animation still', () => {
    const { animator, step, target } = setup();
    act(() => { animator.tween({ target, to: 50, ms: 1000, easing: linear }); });
    step(0);
    step(300);
    act(() => { animator.setTimeScale(0); });
    step(500);
    expect(target.read()).toBeCloseTo(22, 6);
  });
});
