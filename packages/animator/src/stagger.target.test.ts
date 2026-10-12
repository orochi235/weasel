import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createTarget, type Target } from './target';
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
    const end = now + ms;
    while (now < end) {
      now += Math.min(16, end - now);
      for (const cb of frameCbs.splice(0)) cb(now);
    }
  };
  return { animator: result.current, advance };
}

/** Values the test owns, each behind a target. */
function values(...start: number[]): { held: number[]; targets: Target<number>[] } {
  const held = start.slice();
  return { held, targets: held.map((_, i) => createTarget<number>({ get: () => held[i]!, set: (v) => { held[i] = v; } })) };
}

describe('animator.stagger over targets', () => {
  it('.tween moves each item, where the items are targets', () => {
    const { animator, advance } = mountAnimator();
    const { held, targets } = values(0, 0, 0);
    animator.stagger(targets, 50).tween({ to: (target) => target.committed() + 10, ms: 100, easing: (t) => t });
    // A target commits its destination as its tween starts, so only the first has.
    expect(held).toEqual([10, 0, 0]);
    expect(targets[0]!.read()).toBe(0);
    advance(64);
    expect(held).toEqual([10, 10, 0]);
    expect(targets[0]!.read()).toBeCloseTo(6.4, 6);
    advance(300);
    expect(held).toEqual([10, 10, 10]);
    expect(targets.map((t) => t.read())).toEqual([10, 10, 10]);
    expect(animator.isActive()).toBe(false);
  });

  it('.spring moves each item, where the items are targets', () => {
    const { animator, advance } = mountAnimator();
    const { held, targets } = values(0, 100);
    animator.stagger(targets, 50).spring({ to: (target) => target.committed() + 20, preset: 'stiff' });
    expect(held).toEqual([20, 100]);
    advance(64);
    expect(held).toEqual([20, 120]);
    expect(targets[1]!.read()).toBeLessThan(120);
    advance(4000);
    expect(targets.map((t) => t.read())).toEqual([20, 120]);
    expect(animator.isActive()).toBe(false);
  });

  it('takes the target from `target`, for items that are not targets', () => {
    const { animator, advance } = mountAnimator();
    const { held, targets } = values(0, 0);
    const seen: Array<[number, string, number]> = [];
    const done: string[] = [];
    animator.stagger(['a', 'b'], 0).tween({
      target: (_item, i) => targets[i]!,
      to: (_item, i) => (i + 1) * 10,
      ms: 32,
      easing: (t) => t,
      onTick: (v, item, i) => seen.push([v, item, i]),
      onDone: (item) => done.push(item),
    });
    advance(64);
    expect(held).toEqual([10, 20]);
    expect(seen.at(-1)).toEqual([20, 'b', 1]);
    expect(done).toEqual(['a', 'b']);
  });

  it('.spring still hands values to `onTick` where no target is named', () => {
    const { animator, advance } = mountAnimator();
    const last: Record<string, number> = {};
    animator.stagger(['a', 'b'], 0).spring({
      from: 0, to: (_item, i) => (i + 1) * 10, preset: 'stiff',
      onTick: (v, item) => { last[item] = v; },
    });
    advance(4000);
    expect(last.a).toBeCloseTo(10, 1);
    expect(last.b).toBeCloseTo(20, 1);
  });

  it('cancels the whole run by its `cancelKey`, the waiting items included', () => {
    const { animator, advance } = mountAnimator();
    const { held, targets } = values(0, 0);
    animator.stagger(targets, 100).tween({ to: 10, ms: 1000, cancelKey: 'row' });
    advance(16);
    animator.cancelKey('row');
    advance(500);
    expect(held[1]).toBe(0);
    expect(animator.isActive()).toBe(false);
  });

  it('refuses options with no target to move and no `onTick` to tell', () => {
    const { animator } = mountAnimator();
    // @ts-expect-error a string is not a target, and the options name none
    expect(() => animator.stagger(['a'], 0).tween({ to: 1, ms: 10 }))
      .toThrow(/`\.tween` needs a `target`, items that are targets, or an `onTick`/);
  });
});
