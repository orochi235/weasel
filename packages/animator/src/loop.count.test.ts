import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimator } from './useAnimator';

function mountAnimator() {
  let now = 0;
  const frameCbs: ((t: number) => void)[] = [];
  const { result } = renderHook(() => useAnimator({
    now: () => now,
    requestFrame: (cb) => { frameCbs.push(cb); return frameCbs.length; },
    cancelFrame: () => {},
  }));
  const advance = (ms: number): void => {
    now += ms;
    for (const cb of frameCbs.splice(0)) cb(now);
  };
  return { animator: result.current, advance };
}

describe('animator.loop: count', () => {
  it.each([NaN, 2.5, -1, -Infinity])('refuses a count of %s', (count) => {
    const { animator } = mountAnimator();
    const factory = vi.fn();
    expect(() => animator.loop(factory, { count, cancelKey: 'l' })).toThrow(RangeError);
    expect(() => animator.tweenLoop({ from: 0, to: 1, ms: 10, count, onTick: () => {} })).toThrow(RangeError);
    expect(factory).not.toHaveBeenCalled();
    expect(animator.isActive()).toBe(false);
  });

  it('takes 0 and Infinity', () => {
    const { animator } = mountAnimator();
    const onDone = vi.fn();
    animator.loop(() => { throw new Error('never'); }, { count: 0, onDone });
    expect(onDone).toHaveBeenCalledTimes(1);
    const h = animator.loop((_, next) => animator.tween({ from: 0, to: 1, ms: 10, onTick: () => {}, onDone: next }), { count: Infinity });
    expect(animator.isActive()).toBe(true);
    h.cancel();
  });
});
