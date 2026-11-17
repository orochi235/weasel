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

describe('animator.loop: a pass that cannot start', () => {
  it('leaves nothing registered when pass 0 throws', () => {
    const { animator } = mountAnimator();
    const boom = new Error('boom');
    expect(() => animator.loop(() => { throw boom; }, { cancelKey: 'l' })).toThrow(boom);
    expect(animator.isActive('l')).toBe(false);
    expect(animator.isActive()).toBe(false);
  });

  it('ends the loop when a later pass throws', () => {
    const { animator, advance } = mountAnimator();
    const onDone = vi.fn();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    animator.loop((i, next) => {
      if (i === 1) throw new Error('boom');
      return animator.tween({ from: 0, to: 1, ms: 10, onTick: () => {}, onDone: next });
    }, { cancelKey: 'l', onDone });
    advance(0);
    advance(20);
    advance(20);
    expect(animator.isActive('l')).toBe(false);
    expect(animator.isActive()).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('leaves nothing registered for a tweenLoop whose ms is NaN', () => {
    const { animator } = mountAnimator();
    expect(() => animator.tweenLoop({ from: 0, to: 1, ms: NaN, onTick: () => {}, cancelKey: 't' })).toThrow(RangeError);
    expect(animator.isActive('t')).toBe(false);
  });
});


describe('animator.stagger: an item that cannot start', () => {
  it('cancels the stagger and its started items when an undelayed item throws', () => {
    const { animator } = mountAnimator();
    const boom = new Error('boom');
    const started: number[] = [];
    expect(() => animator.stagger([0, 1, 2], 0, (_, i) => {
      if (i === 1) throw boom;
      started.push(i);
      return animator.tween({ from: 0, to: 1, ms: 100, onTick: () => {}, cancelKey: `item${i}` });
    }, { cancelKey: 's' })).toThrow(boom);
    expect(started).toEqual([0]);
    expect(animator.isActive('s')).toBe(false);
    expect(animator.isActive()).toBe(false);
  });

  it('cancels the stagger when a delayed item throws', () => {
    const { animator, advance } = mountAnimator();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onDone = vi.fn();
    animator.stagger([0, 1, 2], 50, (_, i) => {
      if (i === 1) throw new Error('boom');
      return animator.tween({ from: 0, to: 1, ms: 10, onTick: () => {}, onDone });
    }, { cancelKey: 's' });
    advance(0);
    advance(60);
    advance(60);
    advance(60);
    expect(animator.isActive('s')).toBe(false);
    expect(animator.isActive()).toBe(false);
    err.mockRestore();
  });
});
