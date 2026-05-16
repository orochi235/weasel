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

  it('registers the loop handle so animator.cancel works', () => {
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
    expect(animator.isActive()).toBe(true);
    animator.cancel(handle);
    const after = iterations.length;
    for (let i = 0; i < 20; i++) advance(50);
    expect(iterations.length).toBe(after);
    expect(animator.isActive()).toBe(false);
  });

  it('cancelKey on a loop cancels via animator.cancelKey and powers isActive(key)', () => {
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
      { cancelKey: 'foo' },
    );
    advance(16);
    expect(animator.isActive('foo')).toBe(true);
    animator.cancelKey('foo');
    const after = iterations.length;
    for (let i = 0; i < 20; i++) advance(50);
    expect(iterations.length).toBe(after);
    expect(animator.isActive('foo')).toBe(false);
  });

  it('loop completes naturally and deregisters from the animator', () => {
    const { animator, advance } = mountAnimator();
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
      { count: 2 },
    );
    for (let i = 0; i < 50; i++) advance(16);
    expect(animator.isActive()).toBe(false);
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

describe('animator.tweenLoop', () => {
  it('direction=restart plays from→to each iteration', () => {
    const { animator, advance } = mountAnimator();
    const values: number[] = [];
    animator.tweenLoop({
      from: 0,
      to: 10,
      ms: 100,
      easing: (t) => t,
      direction: 'restart',
      count: 2,
      onTick: (v) => values.push(v),
    });
    for (let i = 0; i < 30; i++) advance(16);
    // The tween should hit (or near) 10 then restart back near 0.
    const peak = Math.max(...values);
    expect(peak).toBeCloseTo(10, 0);
    // Somewhere in the sequence the value should drop back near 0 between iterations.
    let sawDrop = false;
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 8 && values[i] < 2) {
        sawDrop = true;
        break;
      }
    }
    expect(sawDrop).toBe(true);
  });

  it('direction=alternate flips from/to each iteration', () => {
    const { animator, advance } = mountAnimator();
    const values: number[] = [];
    animator.tweenLoop({
      from: 0,
      to: 10,
      ms: 100,
      easing: (t) => t,
      direction: 'alternate',
      count: 2,
      onTick: (v) => values.push(v),
    });
    for (let i = 0; i < 30; i++) advance(16);
    const max = Math.max(...values);
    const last = values[values.length - 1];
    expect(max).toBeCloseTo(10, 0);
    // After 2 iterations (0→10, 10→0), final value should be near 0.
    expect(last).toBeLessThan(2);
  });

  it('direction=reverse plays to→from each iteration', () => {
    const { animator, advance } = mountAnimator();
    const values: number[] = [];
    animator.tweenLoop({
      from: 0,
      to: 10,
      ms: 100,
      easing: (t) => t,
      direction: 'reverse',
      count: 2,
      onTick: (v) => values.push(v),
    });
    for (let i = 0; i < 30; i++) advance(16);
    // First emitted value should be near 10 (the reversed `from`).
    expect(values[0]).toBeGreaterThan(8);
    // Final value after two reverse iterations should be near 0.
    expect(values[values.length - 1]).toBeLessThan(2);
  });
});
