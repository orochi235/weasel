import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimator } from './useAnimator';

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

describe('animator.loop', () => {
  it('re-invokes the factory each iteration until count', () => {
    const { animator, advance } = mountAnimator();
    const iterations: number[] = [];
    animator.loop(
      (i, next) => {
        iterations.push(i);
        return animator.tween({
          from: 0,
          to: 1,
          ms: 100,
          easing: (t) => t,
          onTick: () => {},
          onDone: next,
        });
      },
      { count: 3 },
    );
    for (let i = 0; i < 50; i++) advance(16);
    expect(iterations).toEqual([0, 1, 2]);
  });

  it('runs indefinitely when count is omitted', () => {
    const { animator, advance } = mountAnimator();
    const iterations: number[] = [];
    const handle = animator.loop((i, next) => {
      iterations.push(i);
      return animator.tween({
        from: 0,
        to: 1,
        ms: 100,
        easing: (t) => t,
        onTick: () => {},
        onDone: next,
      });
    });
    for (let i = 0; i < 50; i++) advance(16);
    expect(iterations.length).toBeGreaterThan(3);
    handle.cancel();
  });

  it('cancel prevents future iterations and cancels current child', () => {
    const { animator, advance } = mountAnimator();
    const iterations: number[] = [];
    const handle = animator.loop((i, next) => {
      iterations.push(i);
      return animator.tween({
        from: 0,
        to: 1,
        ms: 100,
        easing: (t) => t,
        onTick: () => {},
        onDone: next,
      });
    });
    advance(16);
    advance(50);
    handle.cancel();
    const after = iterations.length;
    for (let i = 0; i < 20; i++) advance(50);
    expect(iterations.length).toBe(after);
    // After cancel, the in-flight child should be removed from the animator.
    expect(animator.isActive()).toBe(false);
  });

  it('pause on the loop handle cascades to the current child', () => {
    const { animator, advance } = mountAnimator();
    const samples: number[] = [];
    const handle = animator.loop(
      (_i, next) =>
        animator.tween({
          from: 0,
          to: 100,
          ms: 1000,
          easing: (t) => t,
          onTick: (v) => samples.push(v),
          onDone: next,
        }),
      { count: 2 },
    );
    advance(0);
    advance(200);
    handle.pause();
    expect(handle.isPaused()).toBe(true);
    const frozen = samples[samples.length - 1];
    for (let i = 0; i < 10; i++) advance(50);
    expect(samples[samples.length - 1]).toBeCloseTo(frozen, 1);
    handle.resume();
    expect(handle.isPaused()).toBe(false);
    for (let i = 0; i < 10; i++) advance(50);
    expect(samples[samples.length - 1]).toBeGreaterThan(frozen);
  });

  it('onDone fires when the loop reaches `count` naturally', () => {
    const { animator, advance } = mountAnimator();
    let done = 0;
    animator.loop(
      (_i, next) =>
        animator.tween({
          from: 0,
          to: 1,
          ms: 100,
          easing: (t) => t,
          onTick: () => {},
          onDone: next,
        }),
      { count: 2, onDone: () => done++ },
    );
    for (let i = 0; i < 50; i++) advance(16);
    expect(done).toBe(1);
  });
});
