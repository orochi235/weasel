import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { createTarget } from './target';
import { useAnimator } from './useAnimator';

function setup() {
  const cbs: ((t: number) => void)[] = [];
  let now = 0;
  const { result, unmount } = renderHook(() => useAnimator({
    now: () => now,
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => { cbs.length = 0; },
  }));
  const frame = (t: number): void => act(() => { now = t; for (const cb of cbs.splice(0)) cb(t); });
  return { animator: result.current, frame, unmount, pending: () => cbs.length };
}

function box(start = 0) {
  const b = { committed: start };
  const target = createTarget<number>({ get: () => b.committed, set: (v) => { b.committed = v; } });
  return { b, target };
}

// A tween on a target with no `onTick` is not ticked until it ends; these hold what a caller
// sees of it to what a tween ticked every frame shows.
describe('a tween on a target with no onTick', () => {
  it('ends on the frame its duration is reached, and reports its progress on the way', () => {
    const { animator, frame } = setup();
    const { target } = box();
    let done = 0;
    act(() => { animator.tween({ target, to: 100, ms: 100, easing: linear, onDone: () => { done += 1; } }); });
    frame(0);
    frame(40);
    expect(target.read()).toBeCloseTo(40, 6);
    expect(animator.live()[0]).toMatchObject({ kind: 'tween', elapsed: 40, progress: 0.4 });
    frame(96);
    expect(done).toBe(0);
    frame(112);
    expect(done).toBe(1);
    expect(target.read()).toBe(100);
    expect(animator.isActive()).toBe(false);
  });

  it('ends later by the time it spent paused, and sooner at a higher time scale', () => {
    const { animator, frame } = setup();
    const a = box();
    const b = box();
    const done: string[] = [];
    let ha: { pause(): void; resume(): void } | undefined;
    act(() => {
      ha = animator.tween({ target: a.target, to: 100, ms: 100, easing: linear, onDone: () => done.push('a') });
      animator.tween({ target: b.target, to: 100, ms: 100, easing: linear, onDone: () => done.push('b') })
        .setTimeScale(2);
    });
    frame(0);
    frame(20);
    act(() => ha!.pause());
    frame(50);
    expect(done).toEqual(['b']);
    frame(200);
    expect(a.target.read()).toBeCloseTo(20, 6);
    act(() => ha!.resume());
    frame(270);
    expect(done).toEqual(['b']);
    frame(280);
    expect(done).toEqual(['b', 'a']);
  });

  it('ends by the animator\'s clock, slowed and paused with it', () => {
    const { animator, frame } = setup();
    const { target } = box();
    let done = 0;
    act(() => {
      animator.setTimeScale(0.5);
      animator.tween({ target, to: 100, ms: 100, easing: linear, onDone: () => { done += 1; } });
    });
    frame(0);
    frame(100);
    expect(done).toBe(0);
    act(() => animator.pause());
    frame(1000);
    act(() => animator.resume());
    frame(1090);
    expect(done).toBe(0);
    frame(1100);
    expect(done).toBe(1);
  });

  it('is canceled with everything else when the host unmounts', () => {
    const { animator, frame, unmount } = setup();
    const { b, target } = box();
    let done = 0;
    act(() => { animator.tween({ target, to: 100, ms: 100, easing: linear, onDone: () => { done += 1; } }); });
    frame(0);
    frame(50);
    unmount();
    expect(animator.isActive()).toBe(false);
    expect(b.committed).toBeCloseTo(50, 6);
    expect(done).toBe(0);
  });
});
