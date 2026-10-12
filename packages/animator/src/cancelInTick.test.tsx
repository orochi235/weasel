import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import type { AnimationHandle } from './types';

function mountAnimator() {
  let now = 0;
  const frameCbs: ((t: number) => void)[] = [];
  const { result } = renderHook(() =>
    useAnimator({
      now: () => now,
      requestFrame: (cb) => {
        frameCbs.push(cb);
        return frameCbs.length;
      },
      cancelFrame: () => {},
    }),
  );
  const advance = (ms: number): void => {
    now += ms;
    const due = frameCbs.splice(0);
    for (const cb of due) cb(now);
  };
  return { animator: result.current, advance };
}

describe('an animation canceled from its own onTick', () => {
  it('a spring canceled on its resting frame does not complete', () => {
    const { animator, advance } = mountAnimator();
    const onDone = vi.fn();
    const handle: AnimationHandle = animator.spring<number>({
      from: 0,
      to: 0,
      onTick: () => handle.cancel(),
      onDone,
    });
    for (let i = 0; i < 5; i++) advance(16);
    expect(animator.isActive()).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('a decay canceled on its resting frame does not complete', () => {
    const { animator, advance } = mountAnimator();
    const onDone = vi.fn();
    const handle: AnimationHandle = animator.decay<number>({
      from: 0,
      velocity: 1,
      friction: 0.000001,
      add: (a, b) => a + b,
      scale: (v, k) => v * k,
      magnitude: (v) => Math.abs(v),
      onTick: () => handle.cancel(),
      onDone,
    });
    for (let i = 0; i < 20; i++) advance(100);
    expect(animator.isActive()).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });
});
